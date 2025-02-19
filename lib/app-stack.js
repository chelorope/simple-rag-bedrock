const { Stack, Duration, CfnOutput, RemovalPolicy } = require("aws-cdk-lib");

const s3 = require("aws-cdk-lib/aws-s3");
const lambda = require("aws-cdk-lib/aws-lambda");

const { bedrock } = require("@cdklabs/generative-ai-cdk-constructs");
const { S3EventSource } = require("aws-cdk-lib/aws-lambda-event-sources");
const iam = require("aws-cdk-lib/aws-iam");

class AppStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const resumeBucket = new s3.Bucket(this, "resumeBucket", {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const resumeKnowledgeBase = new bedrock.KnowledgeBase(
      this,
      "resumeKnowledgeBase",
      {
        embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V1,
      }
    );

    const resumeDataSource = new bedrock.S3DataSource(
      this,
      "resumeDataSource",
      {
        bucket: resumeBucket,
        knowledgeBase: resumeKnowledgeBase,
        dataSourceName: "resume",
        chunkingStrategy: bedrock.ChunkingStrategy.FIXED_SIZE,
        maxTokens: 500,
        overlapPercentage: 20,
      }
    );
  }
}

module.exports = { ResumeAiStack };
