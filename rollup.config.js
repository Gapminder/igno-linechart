const path = require('path');

const copy = require("rollup-plugin-copy");
const trash = require("rollup-plugin-delete");
const serve = require("rollup-plugin-serve");
const livereload = require("rollup-plugin-livereload");
const nodeResolve = require("rollup-plugin-node-resolve");


module.exports = {
  input: 'src/main.js',
  output: {
    file: 'build/bundle.js',
    format: 'umd',
    sourcemap: true,
    globals: {
      "mobx": "mobx",
      "d3": "d3"
    }
  },
  plugins: [
    nodeResolve(),
    trash({
      targets: ['build/*']
    }),
    copy({
      targets: [{
        src: [
          "index.html", 
          "style.css", 
          "./node_modules/save-svg-as-png/lib/saveSvgAsPng.js", 
          "./node_modules/vizabi-ddfservice-reader/dist/vizabi-ddfservice-reader.js", 
          "./node_modules/vizabi-ddfservice-reader/dist/vizabi-ddfservice-reader.js.map"
        ],
        dest: "build"
      },{
        src: "assets/",
        dest: "build/"
      }]
    }),
    serve('build'),
    livereload()
  ]
};

