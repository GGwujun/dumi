import { Node } from 'unist';
import visit from 'unist-util-visit';
import demoTransformer, { DEMO_COMPONENT_NAME, getDepsForDemo } from '../demo';
import transformer from '../index';

function visitor(node, i, parent) {
  if (node.tagName === 'div' && node.properties?.type === 'previewer') {
    const source = node.properties?.source || {};
    const yaml = node.properties?.meta || {};
    const raw = source.tsx || source.jsx;
    const isTSX = Boolean(source.tsx);
    let transformCode = raw;

    // transform markdown for previewer desc field
    Object.keys(yaml).forEach(key => {
      if (/^desc(\.|$)/.test(key)) {
        yaml[key] = transformer.markdown(yaml[key]).html;
      }
    });

    // use import way rather than source code way for external demo (for HMR & sourcemap)
    if (node.properties.filePath) {
      transformCode = `
import React, { useEffect } from 'react';
import Demo from '${node.properties.filePath}';

export default () => <Demo />;`;
    }

    // transform demo source code
    const { content: code } = demoTransformer(transformCode, {
      isTSX: Boolean(source.tsx),
    });
    const { dependencies, files } = getDepsForDemo(raw, {
      isTSX,
      fileAbsPath:
        // for external demo
        node.properties.filePath ||
        // for embed demo
        this.data('fileAbsPath'),
    });

    // save code into data then declare them on the top page component
    this.vFile.data.demos = (this.vFile.data.demos || []).concat(
      `const ${DEMO_COMPONENT_NAME}${(this.vFile.data.demos?.length || 0) +
        1} = React.memo(${code});`,
    );

    // replace original node
    parent.children[i] = {
      previewer: true,
      type: 'raw',
      value: `
<DumiPreviewer
  source={${JSON.stringify(source)}}
  {...${JSON.stringify({ ...yaml, dependencies, files })}}
>
  <${DEMO_COMPONENT_NAME}${this.vFile.data.demos.length} />
</DumiPreviewer>`,
    };
  }
}

export default function previewer() {
  return (ast: Node, vFile) => {
    visit(ast, 'element', visitor.bind({ vFile, data: this.data }));
  };
}
