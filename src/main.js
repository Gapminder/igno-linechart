import * as d3 from "d3";
import makeLinechart from "./linechart.js";
import {savePng, saveSvg} from "./download-utils.js"

window.d3 = d3;
window.saveSvgAsPng = saveSvgAsPng;

const INSTRUCTIONS_KEY = "1rfTrNxyC16pS2Lv5RRa0RmFDm2_4UWzbhKXivb5CpkI";
const INSTRUCTIONS_GRAPHS_SHEET = "graph_list";
const INSTRUCTIONS_OPTIONS_SHEET = "options";

function googleSheetLink(key, sheet){
  if(key.includes("google.com")) key = key.split("/d/")[1].split("/")[0];
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
  window.location.search = Object.entries(kv).map(([k,v]) => k + "=" + v).join("&");
}

// fetch instructions
let graphs = [];
let options = {};

const fetch_instructions = [
  d3.csv(googleSheetLink(INSTRUCTIONS_KEY, INSTRUCTIONS_GRAPHS_SHEET))
    .then(result => graphs = result.filter(f => f.id))
    .catch(error => console.error(error)),
  d3.csv(googleSheetLink(INSTRUCTIONS_KEY, INSTRUCTIONS_OPTIONS_SHEET))
    .then(result => result.forEach( ({key, value}) => options[key] = value))
    .catch(error => console.error(error)),
]

// init readers
const fetch_concept_props = [];

const data_sources = {
  "SG-develop": {dataset: "SG-develop", cprops: ["name", "name_short", "format"]},
  "fasttrack": {dataset: "fasttrack", cprops: ["name", "name_short", "format"]},
  "wdi-master": {dataset: "wdi-master", cprops: ["name"]},
  "google-spreadsheet": {}
}

Object.entries(data_sources).map(([k, v]) => {
  if(k === "google-spreadsheet") {
    v.reader = {
      read: function(path) {
        const [sheet, link] = path.split(" from ");
        return d3.csv(googleSheetLink(link, sheet)).catch(error => console.error(error))
          .then(data => {
            data.forEach(d => {
              d["y"] = +d[data.columns[1]];
              d["time"] = new Date(d[data.columns[0]])
            });
            return data;
          });
      }
    }
    v.concepts = {};
  } else {
    v.reader = DDFServiceReader.getReader();
    v.reader.init({service: 'https://big-waffle.gapminder.org', name: v.dataset});
    v.conceptPromise = v.reader
      .read({select: {key: ["concept"], value: v.cprops}, from: "concepts"})
      .then(result => v.concepts = result)
      .catch(error => console.error(error));
    fetch_concept_props.push(v.conceptPromise);
  }
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
    DOM.graphs.append("div").append("a")
      .text(graph.id + ": " + graph.title)
      .on("click", ()=>{setUrlParams({graph: graph.id})});
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
          .then((view)=>{
            if(format == "png") {
              savePng(view.select("svg"), graph.id + " - " + graph.title + ".png")
                .then(()=>view.remove());
            } else if (format == "svg") {
              saveSvg(view.select("svg"), graph.id + " - " + graph.title + ".svg")
                .then(()=>view.remove());
            }
          });
      } else {
        clearInterval(interval);
      }
    
    }, 300); 
    
  }
  
  
  

  
  
  
  
})





  
