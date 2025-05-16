//evals.ts

import { EvalConfig } from 'mcp-evals';
import { openai } from "@ai-sdk/openai";
import { grade, EvalFunction } from "mcp-evals";

const discoveryEval: EvalFunction = {
    name: "discovery",
    description: "Evaluates the creation of a test case on a given test target using the discovery tool",
    run: async () => {
        const result = await grade(openai("gpt-4"), "Create a test case named 'LoginFlow' for test target with ID '123e4567-e89b-12d3-a456-426614174000' using the prompt 'Verify user login functionality.' Include a tag 'auth' and folder name 'UserAuthenticationTests'.");
        return JSON.parse(result);
    }
};

const searchEval: EvalFunction = {
    name: "search Tool Evaluation",
    description: "Evaluates the search tool's functionality",
    run: async () => {
        const result = await grade(openai("gpt-4"), "Please search the octomind documentation for any information about advanced configuration options.");
        return JSON.parse(result);
    }
};

const getTestCaseEval: EvalFunction = {
    name: "getTestCase Evaluation",
    description: "Evaluates retrieving a test case for a given test target and test case ID",
    run: async () => {
        const result = await grade(openai("gpt-4"), "Can you retrieve the test case with ID 123e4567-e89b-12d3-a456-426614174000 for the test target with ID 123e4567-e89b-12d3-a456-426614174001 and show its interactions and assertions?");
        return JSON.parse(result);
    }
};

const executeTestsEval: EvalFunction = {
    name: "executeTests Tool Evaluation",
    description: "Tests the triggering of a set of tests for a given test target",
    run: async () => {
        const result = await grade(openai("gpt-4"), "Please execute the tests using the executeTests tool for testTargetId=8176fa6f-12f3-45f7-8acb-2e9d5e6c93e6 on the URL=https://example.com with environmentName=staging, and apply the tags=['integration','regression'].");
        return JSON.parse(result);
    }
};

const getEnvironmentsEval: EvalFunction = {
    name: "getEnvironments Evaluation",
    description: "Evaluates the retrieval of environments for a given test target",
    run: async () => {
        const result = await grade(openai("gpt-4"), "Retrieve the list of environments for test target ID 123e4567-e89b-12d3-a456-426614174000 and return them in JSON format.");
        return JSON.parse(result);
    }
};

const config: EvalConfig = {
    model: openai("gpt-4"),
    evals: [discoveryEval, searchEval, getTestCaseEval, executeTestsEval, getEnvironmentsEval]
};
  
export default config;
  
export const evals = [discoveryEval, searchEval, getTestCaseEval, executeTestsEval, getEnvironmentsEval];