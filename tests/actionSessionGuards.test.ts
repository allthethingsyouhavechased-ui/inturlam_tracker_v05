import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import ts from "typescript";

const ACTION_DIRECTORY = path.join(process.cwd(), "lib", "actions");
const ACTION_FILES = fs
  .readdirSync(ACTION_DIRECTORY)
  .filter((fileName) => fileName.endsWith(".ts") && fileName !== "identity.ts")
  .sort();

function isExportedAsyncFunction(
  node: ts.Node,
): node is ts.FunctionDeclaration & { name: ts.Identifier; body: ts.Block } {
  if (!ts.isFunctionDeclaration(node) || !node.name || !node.body) return false;
  const modifiers = node.modifiers ?? [];
  return (
    modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
    modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
  );
}

function awaitedCallName(expression: ts.Expression | undefined): string | null {
  if (!expression || !ts.isAwaitExpression(expression)) return null;
  const call = expression.expression;
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return null;
  return call.expression.text;
}

function startsWithSessionGuard(node: ts.FunctionDeclaration & { body: ts.Block }): boolean {
  const [firstStatement] = node.body.statements;
  if (!firstStatement) return false;
  if (ts.isExpressionStatement(firstStatement)) {
    return ["requireSession", "requireTeamSession", "requireGuestSession"].includes(awaitedCallName(firstStatement.expression) ?? "");
  }
  if (!ts.isVariableStatement(firstStatement)) return false;
  const [declaration] = firstStatement.declarationList.declarations;
  return ["requireSession", "requireTeamSession", "requireGuestSession"].includes(awaitedCallName(declaration?.initializer) ?? "");
}

describe("mutasyon Server Action oturum koruması", () => {
  it("tüm action'ları ilk işlem olarak actor türüne uygun session guard ile korur", () => {
    const foundActions: string[] = [];
    const unguardedActions: string[] = [];

    for (const fileName of ACTION_FILES) {
      const filePath = path.join(process.cwd(), "lib", "actions", fileName);
      const source = fs.readFileSync(filePath, "utf8");
      const sourceFile = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );

      for (const statement of sourceFile.statements) {
        if (!isExportedAsyncFunction(statement)) continue;
        foundActions.push(statement.name.text);
        if (!startsWithSessionGuard(statement)) {
          unguardedActions.push(statement.name.text);
        }
      }
    }

    assert.ok(foundActions.length > 0, "Hiç Server Action bulunamadı.");
    assert.deepEqual(unguardedActions, []);
  });
});
