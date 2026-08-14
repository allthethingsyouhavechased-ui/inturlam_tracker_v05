import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import ts from "typescript";

const MANAGER_ACTIONS: Record<string, string[]> = {
  "brands.ts": [
    "createBrandAction",
    "updateBrandAction",
    "archiveBrandAction",
    "deleteBrandAction",
    "unarchiveBrandAction",
  ],
  "clusters.ts": [
    "createClusterAction",
    "renameClusterAction",
    "deleteClusterAction",
  ],
  "content.ts": ["deleteContentItemAction"],
  "tasks.ts": ["deleteTaskAction", "bulkDeleteTasksAction"],
  "templates.ts": ["deleteTemplateAction", "deleteTemplateItemAction"],
};

function firstAwaitedCallName(node: ts.FunctionDeclaration): string | null {
  const firstStatement = node.body?.statements[0];
  if (!firstStatement) return null;

  let expression: ts.Expression | undefined;
  if (ts.isExpressionStatement(firstStatement)) {
    expression = firstStatement.expression;
  } else if (ts.isVariableStatement(firstStatement)) {
    expression = firstStatement.declarationList.declarations[0]?.initializer;
  }

  if (!expression || !ts.isAwaitExpression(expression)) return null;
  const call = expression.expression;
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return null;
  return call.expression.text;
}

function exportedFunctions(fileName: string): Map<string, ts.FunctionDeclaration> {
  const filePath = path.join(process.cwd(), "lib", "actions", fileName);
  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const functions = new Map<string, ts.FunctionDeclaration>();

  for (const statement of sourceFile.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name) continue;
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (exported) functions.set(statement.name.text, statement);
  }
  return functions;
}

describe("yönetici mutasyon sınırı", () => {
  it("marka yapılandırması ve kalıcı iş kayıtlarını ilk işlemde yöneticiye sınırlar", () => {
    for (const [fileName, actionNames] of Object.entries(MANAGER_ACTIONS)) {
      const functions = exportedFunctions(fileName);
      for (const actionName of actionNames) {
        const action = functions.get(actionName);
        assert.ok(action, `${fileName} içinde ${actionName} bulunamadı.`);
        assert.equal(
          firstAwaitedCallName(action),
          "requireManager",
          `${fileName}:${actionName} ilk işlem olarak requireManager çağırmalı.`,
        );
      }
    }
  });

  it("yönetici olmayan ekip üyesinden yapılandırma ve kalıcı silme kontrollerini gizler", () => {
    const brandsPage = fs.readFileSync(path.join(process.cwd(), "app/brands/page.tsx"), "utf8");
    assert.match(brandsPage, /const canManageBrands = me\.is_manager === 1/);
    assert.match(brandsPage, /canManageBrands && \([\s\S]*<ClusterManager/);
    assert.match(brandsPage, /canManageBrands && \([\s\S]*<ArchiveBrandButton/);

    const brandPage = fs.readFileSync(path.join(process.cwd(), "app/brands/[brandId]/page.tsx"), "utf8");
    assert.match(brandPage, /canManageBrand \? \([\s\S]*<EditBrandForm/);

    const contentPage = fs.readFileSync(
      path.join(process.cwd(), "app/brands/[brandId]/content/[contentId]/page.tsx"),
      "utf8",
    );
    assert.match(contentPage, /canDeleteContent && <DeleteContentButton/);

    const taskPage = fs.readFileSync(path.join(process.cwd(), "app/tasks/[taskId]/page.tsx"), "utf8");
    assert.match(taskPage, /canDeleteTask && <DeleteTaskButton/);

    const tasksPage = fs.readFileSync(path.join(process.cwd(), "app/tasks/page.tsx"), "utf8");
    assert.match(tasksPage, /canDeleteTasks=\{me\.is_manager === 1\}/);

    const taskExplorer = fs.readFileSync(path.join(process.cwd(), "components/TaskExplorer.tsx"), "utf8");
    assert.match(taskExplorer, /canDeleteTasks=\{canDeleteTasks\}/);

    const taskList = fs.readFileSync(path.join(process.cwd(), "components/TaskListView.tsx"), "utf8");
    assert.match(taskList, /canDeleteTasks && \([\s\S]*bulkDeleteTasksAction/);

    const templatesPage = fs.readFileSync(path.join(process.cwd(), "app/templates/page.tsx"), "utf8");
    const templateManager = fs.readFileSync(path.join(process.cwd(), "components/TemplateManager.tsx"), "utf8");
    assert.match(templatesPage, /canDeleteTemplates=\{me\.is_manager === 1\}/);
    assert.match(templateManager, /canDeleteTemplates &&/);
  });
});
