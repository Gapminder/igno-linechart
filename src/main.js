import * as d3 from "d3";
import makeLinechart from "./linechart.js";

window.d3 = d3;
window.saveSvgAsPng = saveSvgAsPng;

const INSTRUCTIONS_KEY = "1rfTrNxyC16pS2Lv5RRa0RmFDm2_4UWzbhKXivb5CpkI";
const INSTRUCTIONS_GRAPHS_SHEET = "graph_list";
const INSTRUCTIONS_OPTIONS_SHEET = "options";

function googleSheetLink(key, sheet){
  return `https://docs.google.com/spreadsheets/d/${key}/gviz/tq?tqx=out:csv&sheet=${sheet}`;
}

function getUrlParams(search = window.location.search) {
    const hashes = search.slice(search.indexOf('?') + 1).split('&')
    const params = {}
    hashes.map(hash => {
        const [key, val] = hash.split('=')
        if(key) params[key] = decodeURIComponent(val)
    })
    return params
}

function setUrlParams(kv){
  let v = Object.values(kv)
  window.location.search = Object.keys(kv).map((k,i) => k + "=" + v[i]).join("&")
  
}

// fetch instructions
let graphs = [];
let options = {};

const fetch_instructions = [
  d3.csv(googleSheetLink(INSTRUCTIONS_KEY, INSTRUCTIONS_GRAPHS_SHEET))
    .then(result => graphs = result)
    .catch(error => console.error(error)),
  d3.csv(googleSheetLink(INSTRUCTIONS_KEY, INSTRUCTIONS_OPTIONS_SHEET))
    .then(result => result.forEach(kv => options[kv.key] = kv.value))
    .catch(error => console.error(error)),
]

// init readers
const fetch_concept_props = [];

const data_sources = {
  "SG-develop": {dataset: "SG-develop"},
  "fasttrack": {dataset: "fasttrack"},
  "wdi-master": {dataset: "wdi-master"}
}

Object.keys(data_sources).map(m => {
  const v = data_sources[m];
  v.reader = DDFServiceReader.getReader();
  v.reader.init({service: 'https://big-waffle.gapminder.org', name: v.dataset});
  v.conceptPromise = v.reader
    .read({select: {key: ["concept"], value: ["name", "name_short", "format"]}, from: "concepts"})
    .then(result => v.concepts = result)
    .catch(error => console.error(error));
  fetch_concept_props.push(v.conceptPromise);
})



// wait when all async stuff is complete 
Promise.all(fetch_concept_props.concat(fetch_instructions)).then(result => {
  
  const DOM = {};
  DOM.container = d3.select("#container");
  DOM.backButton = DOM.container.append("div").attr("class", "back").append("a").text("back").on("click", ()=>{setUrlParams({})});
  DOM.nav = DOM.container.append("div").attr("class", "nav");
  
  DOM.nav_graphs = DOM.nav.append("div").attr("class", "section");
  DOM.graphsTitle = DOM.nav_graphs.append("div").attr("class", "title").text("Graphs:");
  DOM.graphs = DOM.nav_graphs.append("div").attr("class", "list");
  DOM.graphsDownloadAllPng = DOM.nav.append("div").attr("class", "dl-all").text("Download all as PNG").on("click", () => downloadAll(graphs, "png"));
  DOM.graphsDownloadAllSvg = DOM.nav.append("div").attr("class", "dl-all").text("Download all as SVG").on("click", () => downloadAll(graphs, "svg"));
  
  DOM.summary = DOM.container.append("div").attr("class", "summary");  
  DOM.render = DOM.container.append("div").attr("class", "render");
  
  
  graphs.forEach(graph => {
    DOM.graphs.append("div").append("a").text(graph.id + ": " + graph.title).on("click", ()=>{setUrlParams({graph: graph.id})});
  })
  

  let params = getUrlParams();
  let paramsEmpty = Object.keys(params).length == 0;
  DOM.nav.classed("invisible", !paramsEmpty);
  DOM.backButton.classed("invisible", paramsEmpty);
  
  
  function render (params){
    if (params.graph){
      let graph = graphs.find(f => f.id == params.graph);
      makeLinechart({view: DOM.render, graph, data_sources, options});
    }
  };
  
  render(params);
  
  
  function downloadAll(graphs, format="png") {
    
    const interval = setInterval(function(){
      const graph = graphs.pop();
      
      if (graph) {
        makeLinechart({view: DOM.render, graph, data_sources, options})
          .then((svg)=>{
          
            
          
            if(format == "png") {
              savePng(svg, graph.id + " - " + graph.title + ".png")
                .then(()=>svg.remove());
            } else if (format == "svg") {
              saveSvg(svg, graph.id + " - " + graph.title + ".svg")
                .then(()=>svg.remove());
            }
          });
      } else {
        clearInterval(interval);
      }
    
    }, 300); 
    
  }
  
  
  
  async function savePng(view, name){
    return saveSvgAsPng(view.node(), name, {scale: 2});
  }
  
  
  function saveSvg(view, name) {
    
    var ContainerElements = ["svg","g","defs","marker"];
    var RelevantStyles = {"rect":["fill","stroke","stroke-width"],"path":["fill","stroke","stroke-width"],"marker":["fill","stroke","stroke-width"],"circle":["fill","stroke","stroke-width"],"line":["stroke","stroke-width"],"text":["fill","font-size","text-anchor","visibility","font-family"],"polygon":["stroke","fill"]};


    function read_Element(ParentNode, OrigData){
        var Children = ParentNode.childNodes;
        var OrigChildDat = OrigData.childNodes;     

        for (var cd = 0; cd < Children.length; cd++){
            var Child = Children[cd];

            var TagName = Child.tagName;
            if (ContainerElements.indexOf(TagName) != -1){
                read_Element(Child, OrigChildDat[cd])
            } else if (TagName in RelevantStyles){
                var StyleDef = window.getComputedStyle(OrigChildDat[cd]);

                var StyleString = "";
                for (var st = 0; st < RelevantStyles[TagName].length; st++){
                    StyleString += RelevantStyles[TagName][st] + ":" + StyleDef.getPropertyValue(RelevantStyles[TagName][st]) + "; ";
                }

                Child.setAttribute("style",StyleString);
            }
        }

    }

    function export_StyledSVG(SVGElem, name){


        var oDOM = SVGElem.cloneNode(true)
        read_Element(oDOM, SVGElem)

        var data = new XMLSerializer().serializeToString(oDOM);
        var svg = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
        var url = URL.createObjectURL(svg);

        var link = document.createElement("a");
        link.setAttribute("target","_blank");
        var Text = document.createTextNode("Export");
        link.appendChild(Text);
        link.download = name;
        link.href=url;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    export_StyledSVG(view.node(), name);
    return Promise.resolve();
    
//    view.node().setAttribute("xmlns", "http://www.w3.org/2000/svg");
//    var svgData = view.node().outerHTML;
//    var preface = '<?xml version="1.0" standalone="no"?>\r\n';
//    var svgBlob = new Blob([preface, svgData], {type:"image/svg+xml;charset=utf-8"});
//    var svgUrl = URL.createObjectURL(svgBlob);
//    var downloadLink = document.createElement("a");
//    downloadLink.href = svgUrl;
//    downloadLink.download = name;
//    document.body.appendChild(downloadLink);
//    downloadLink.click();
//    document.body.removeChild(downloadLink);
//    return Promise.resolve();
  }
  
  
})





  
