import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export function assertWorkerDefaultFetch(source, fileName = "worker.js") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );

  const declarations = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        declarations.set(declaration.name.text, declaration.initializer);
      }
    }
  }

  let defaultExpression = null;
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      defaultExpression = statement.expression;
      break;
    }

    if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
      continue;
    }

    for (const element of statement.exportClause.elements) {
      if (element.name.text !== "default") continue;
      const localName = element.propertyName?.text;
      if (!localName) {
        throw new Error(`${fileName} exports default without a resolvable local binding.`);
      }
      defaultExpression = ts.factory.createIdentifier(localName);
      break;
    }
    if (defaultExpression) break;
  }

  if (!defaultExpression) {
    throw new Error(`${fileName} must expose an ESM default export.`);
  }

  const resolved = resolveExpression(defaultExpression, declarations);
  if (!ts.isObjectLiteralExpression(resolved) || !objectHasFetchFunction(resolved, declarations)) {
    throw new Error(`${fileName} default export must be an object with a callable fetch handler.`);
  }

  return true;
}

function resolveExpression(expression, declarations, seen = new Set()) {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) current = current.expression;

  if (!ts.isIdentifier(current)) return current;
  if (seen.has(current.text)) {
    throw new Error(`Circular Worker export binding: ${current.text}`);
  }

  const initializer = declarations.get(current.text);
  if (!initializer) return current;
  seen.add(current.text);
  return resolveExpression(initializer, declarations, seen);
}

function objectHasFetchFunction(objectLiteral, declarations) {
  for (const property of objectLiteral.properties) {
    const name = propertyNameText(property.name);
    if (name !== "fetch") continue;

    if (ts.isMethodDeclaration(property)) return true;
    if (ts.isPropertyAssignment(property)) {
      const initializer = resolveExpression(property.initializer, declarations);
      return ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer);
    }
    if (ts.isShorthandPropertyAssignment(property)) {
      const initializer = declarations.get(property.name.text);
      return Boolean(initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)));
    }
  }
  return false;
}

function propertyNameText(name) {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

async function main() {
  const workerPath = process.argv[2];
  if (!workerPath) throw new Error("Usage: node scripts/validate-worker-entry.mjs <worker-entry.js>");
  const source = await readFile(workerPath, "utf8");
  assertWorkerDefaultFetch(source, workerPath);
  console.log(`Validated Worker contract: ${workerPath} has an ESM default object with fetch().`);
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
