import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import ts from "typescript";

const APP_DIRECTORY = path.join(process.cwd(), "app");

function pageFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return pageFiles(absolute);
    return entry.name === "page.tsx" ? [absolute] : [];
  });
}

function defaultPageFunction(sourceFile: ts.SourceFile): ts.FunctionDeclaration | undefined {
  return sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement)
      && Boolean(statement.body)
      && Boolean(statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)),
  );
}

function awaitedCallName(expression: ts.Expression | undefined): string | null {
  if (!expression || !ts.isAwaitExpression(expression)) return null;
  const call = expression.expression;
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return null;
  return call.expression.text;
}

function firstGuardName(node: ts.FunctionDeclaration): string | null {
  const [firstStatement] = node.body?.statements ?? [];
  if (!firstStatement) return null;
  if (ts.isExpressionStatement(firstStatement)) {
    return awaitedCallName(firstStatement.expression);
  }
  if (!ts.isVariableStatement(firstStatement)) return null;
  const [declaration] = firstStatement.declarationList.declarations;
  return awaitedCallName(declaration?.initializer);
}

describe("sayfa oturum sınırı", () => {
  it("giriş ekranı dışındaki bütün sayfaları veri okumadan önce korur", () => {
    const unguarded: string[] = [];

    for (const filePath of pageFiles(APP_DIRECTORY)) {
      if (filePath.startsWith(path.join(APP_DIRECTORY, "whoami"))) continue;
      const source = fs.readFileSync(filePath, "utf8");
      const sourceFile = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const page = defaultPageFunction(sourceFile);
      const guard = page ? firstGuardName(page) : null;
      if (guard !== "requirePageSession" && guard !== "requireReportAccess" && guard !== "requireGuestSession") {
        unguarded.push(path.relative(process.cwd(), filePath));
      }
    }

    assert.deepEqual(unguarded, []);
  });
});
