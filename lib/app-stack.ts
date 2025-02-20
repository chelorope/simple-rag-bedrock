import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";

import * as genAICondtructs from "@cdklabs/generative-ai-cdk-constructs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as iam from "aws-cdk-lib/aws-iam";

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /*********  S3 Bucket and Data Source *********/

    const resumeBucket = new s3.Bucket(this, "resumeBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const resumeKnowledgeBase = new genAICondtructs.bedrock.VectorKnowledgeBase(
      this,
      "resumeKnowledgeBase",
      {
        embeddingsModel:
          genAICondtructs.bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V1,
        instruction:
          "Use this knowledge base to answer questions about resumes",
      }
    );

    const resumeDataSource = new genAICondtructs.bedrock.S3DataSource(
      this,
      "resumeDataSource",
      {
        bucket: resumeBucket,
        knowledgeBase: resumeKnowledgeBase,
        dataSourceName: "resume",
        chunkingStrategy: genAICondtructs.bedrock.ChunkingStrategy.FIXED_SIZE,
        // maxTokens: 500,
        // overlapPercentage: 20,
      }
    );

    const s3PutEventSource = new lambdaEventSources.S3EventSource(
      resumeBucket,
      {
        events: [s3.EventType.OBJECT_CREATED_PUT],
      }
    );

    /*********  Ingestion Job *********/

    const lambdaIngestionJob = new lambda.Function(this, "IngestionJob", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("./src/IngestJob"),
      timeout: cdk.Duration.minutes(5),
      environment: {
        KNOWLEDGE_BASE_ID: resumeKnowledgeBase.knowledgeBaseId,
        DATA_SOURCE_ID: resumeDataSource.dataSourceId,
      },
    });

    lambdaIngestionJob.addEventSource(s3PutEventSource);

    lambdaIngestionJob.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:StartIngestionJob"],
        resources: [resumeKnowledgeBase.knowledgeBaseArn],
      })
    );

    /*********  Query Knowledge Base *********/

    const lambdaQuery = new lambda.Function(this, "Query", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("./src/queryKnowledgeBase"),
      timeout: cdk.Duration.minutes(5),
      environment: {
        KNOWLEDGE_BASE_ID: resumeKnowledgeBase.knowledgeBaseId,
      },
    });

    const fnUrl = lambdaQuery.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.BUFFERED,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ["*"],
      },
    });

    lambdaQuery.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:RetrieveAndGenerate",
          "bedrock:Retrieve",
          "bedrock:InvokeModel",
        ],
        resources: ["*"],
      })
    );

    new cdk.CfnOutput(this, "KnowledgeBaseId", {
      value: resumeKnowledgeBase.knowledgeBaseId,
    });

    new cdk.CfnOutput(this, "QueryFunctionUrl", {
      value: fnUrl.url,
    });

    new cdk.CfnOutput(this, "ResumeBucketName", {
      value: resumeBucket.bucketName,
    });
  }
}

module.exports = { AppStack };
