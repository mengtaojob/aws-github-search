import { readFile } from 'node:fs/promises';
import { parseDocument } from 'yaml';
const tags = ['Ref', 'Sub', 'GetAtt', 'GetAZs', 'Select', 'If', 'Equals'].map((name) => ({ tag: `!${name}`, resolve: (value) => value }));
for (const path of ['infrastructure/template.yaml', 'infrastructure/oidc-bootstrap.yaml', 'infrastructure/github-deploy-role.yaml', '.github/workflows/ci.yml', '.github/workflows/deploy.yml', 'compose.yaml']) {
  const doc = parseDocument(await readFile(path, 'utf8'), { customTags: tags });
  if (doc.errors.length) throw new Error(`${path}: ${doc.errors.join(', ')}`);
  console.log(`YAML parsed: ${path}`);
}
console.log('This is a YAML syntax check. Run sam validate --lint for AWS schema validation.');
