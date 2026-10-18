/** Runtime names, default handlers and the starter code the Lambda console shows. */

export const RUNTIME_LABELS: Record<string, string> = {
    'python3.12': 'Python 3.12', 'python3.11': 'Python 3.11', 'nodejs20.x': 'Node.js 20.x',
    'nodejs18.x': 'Node.js 18.x', java21: 'Java 21', dotnet8: '.NET 8 (C#/F#/PowerShell)',
    'go1.x': 'Go 1.x', 'ruby3.3': 'Ruby 3.3',
};

export function runtimeLabel(runtime: string): string {
    return RUNTIME_LABELS[runtime] || runtime;
}

export function defaultHandler(runtime: string): string {
    if (runtime.startsWith('python')) return 'lambda_function.lambda_handler';
    if (runtime.startsWith('nodejs')) return 'index.handler';
    if (runtime.startsWith('ruby')) return 'lambda_function.lambda_handler';
    if (runtime.startsWith('java')) return 'example.Hello::handleRequest';
    if (runtime.startsWith('dotnet')) return 'Function::Function.Function::FunctionHandler';
    return 'bootstrap';
}

export function codeFile(runtime: string): { file: string; code: string } {
    if (runtime.startsWith('python')) {
        return {
            file: 'lambda_function.py',
            code: "import json\n\ndef lambda_handler(event, context):\n    # TODO implement\n    return {\n        'statusCode': 200,\n        'body': json.dumps('Hello from Lambda!')\n    }\n",
        };
    }
    if (runtime.startsWith('nodejs')) {
        return {
            file: 'index.mjs',
            code: "export const handler = async (event) => {\n  // TODO implement\n  const response = {\n    statusCode: 200,\n    body: JSON.stringify('Hello from Lambda!'),\n  };\n  return response;\n};\n",
        };
    }
    if (runtime.startsWith('ruby')) {
        return { file: 'lambda_function.rb', code: "require 'json'\n\ndef lambda_handler(event:, context:)\n    # TODO implement\n    { statusCode: 200, body: JSON.generate('Hello from Lambda!') }\nend\n" };
    }
    return { file: 'README', code: 'The inline code editor does not support this runtime. Upload a .zip file.\n' };
}

export const HELLO_EVENT = JSON.stringify({ key1: 'value1', key2: 'value2', key3: 'value3' }, null, 2);

/** A memory/timeout value as the console validates it. */
export function memoryProblem(value: number): string {
    return Number.isInteger(value) && value >= 128 && value <= 10240 ? '' : 'Memory must be between 128 MB and 10240 MB.';
}
export function timeoutProblem(seconds: number): string {
    return Number.isInteger(seconds) && seconds >= 1 && seconds <= 900 ? '' : 'Timeout must be between 1 second and 15 minutes.';
}
