const {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
} = require("@aws-sdk/client-bedrock-agent-runtime");

const client = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION,
});

exports.handler = async (event, context) => {
  const { question } = JSON.parse(event.body);

  const input = {
    // RetrieveAndGenerateRequest
    input: {
      // RetrieveAndGenerateInput
      text: question, // required
    },
    retrieveAndGenerateConfiguration: {
      // RetrieveAndGenerateConfiguration
      type: "KNOWLEDGE_BASE", // required
      knowledgeBaseConfiguration: {
        // KnowledgeBaseRetrieveAndGenerateConfiguration
        knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID, // required
        modelArn: `arn:aws:bedrock:${process.env.AWS_REGION}::foundation-model/anthropic.claude-v2`, // required
      },
    },
  };
  const command = new RetrieveAndGenerateCommand(input);
  const response = await client.send(command);

  return JSON.stringify({
    response: response.output.text,
  });
};
