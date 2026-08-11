import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import ts from "typescript";

const ACTION_FILES = [
  "brands.ts",
  "clusters.ts",
  "content.ts",
  "templates.ts",
  "socialPlan.ts",
] as const;

const EXPECTED_ACTIONS = [
  "createBrandAction",
  "updateBrandAction",
  "archiveBrandAction",
  "deleteBrandAction",
  "unarchiveBrandAction",
  "createClusterAction",
  "renameClusterAction",
  "deleteClusterAction",
  "createContentItemAction",
  "setContentStatusAction",
  "updateContentItemAction",
  "archiveContentItemAction",
  "unarchiveContentItemAction",
  "deleteContentItemAction",
  "createTemplateAction",
  "renameTemplateAction",
  "deleteTemplateAction",
  "addTemplateItemAction",
  "deleteTemplateItemAction",
  "applyTemplateAction",
  "setBrandContentTargetAction",
  "setBrandAssetCountAction",
  "setBrandPlanEntryAction",
].sort();

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

function startsWithSessionGuard(node: ts.FunctionDeclaration & { body: ts.Block }): boolean {
  const [firstStatement] = node.body.statements;
  if (!firstStatement || !ts.isExpressionStatement(firstStatement)) return false;
  const expression = firstStatement.expression;
  if (!ts.isAwaitExpression(expression) || !ts.isCallExpression(expression.expression)) {
    return false;
  }
  const call = expression.expression;
  return (
    ts.isIdentifier(call.expression) &&
    call.expression.text === "requireSession" &&
    call.arguments.length === 0
  );
}

describe("mutasyon Server Action oturum koruması", () => {
  it("hedeflenen tüm action'ları ilk işlem olarak requireSession ile korur", () => {
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

    assert.deepEqual(foundActions.sort(), EXPECTED_ACTIONS);
    assert.deepEqual(unguardedActions, []);
  });
});
