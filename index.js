import fs from 'fs';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import path from 'path';
import { transformFromAst } from 'babel-core';
import ejs from 'ejs';
import JSONLoader from './loader/jsonLoader.js';

let id = 0

const WebpackConfig = {
  module: {
    rules: [
      { test: /\.json$/, use: JSONLoader },
    ],
  },
}

function createAsset(filePath) {
  let source = fs.readFileSync(filePath, {
    encoding: "utf-8"
  })

  WebpackConfig.module.rules.forEach(({ test, use }) => {
    if (test.test(filePath)) {
      if (Array.isArray(use)) {
        use.reverse().forEach((fn) => source = fn(source))
      } else {
        source = use(source)
      }
    }
  })

  const ast = parser.parse(source, {
    sourceType: "module"
  })

  const deps = []
  traverse.default(ast, {
    ImportDeclaration({ node }) {
      deps.push(node.source.value)
    }
  })

  const { code } = transformFromAst(ast, null, {
    presets: ["env"]
  })

  return {
    deps,
    filePath,
    code,
    id: id++,
    mapping: {}
  }
}

function createGraph() {
  const mainAsset = createAsset("example/index.js")
  const queue = [mainAsset]

  for (const asset of queue) {
    asset.deps.forEach(depPath => {
      const child = createAsset(path.resolve("example", depPath))
      asset.mapping[depPath] = child.id
      queue.push(child)
    })
  }

  return queue
}

function build() {
  const graph = createGraph()

  const data = graph.map((asset) => ({
    code: asset.code,
    id: asset.id,
    mapping: asset.mapping
  }))

  const template = fs.readFileSync("./template.ejs", {
    encoding: "utf-8"
  })
  const code = ejs.render(template, { data })

  fs.writeFileSync("./dist/bundle.js", code)
}

build()