import * as d3 from "d3";
import makeLinechart from "./linechart.js";

window.d3 = d3;
window.saveSvgAsPng = saveSvgAsPng;

const QUESTIONS_KEY = "115e3rQgfs96MwkrjN9Hh7GJQVHylng7QzBhgF5FFArw";
const QUESTIONS_IGNOS_SHEET = "Ignos";

const INSTRUCTIONS_KEY = "1OmmVh9M6Q-3Nb0Fy0xGyYsnDYQbl4fBCmvkCa_rdCf0";
const INSTRUCTIONS_GRAPHS_SHEET = "graph_list";
const INSTRUCTIONS_TEMPLATES_SHEET = "all_templates";
const INSTRUCTIONS_OPTIONS_SHEET = "options";
const INSTRUCTIONS_GEOS_SHEET = "all_geos";

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
  let v = d3.values(kv)
  window.location.search = d3.keys(kv).map((k,i) => k + "=" + v[i]).join("&")
  
}

// fetch instructions
let graphs = [];
let templates = [];
let options = {};
let geos = [];
let ignos = [];

const fetch_instructions = [
  d3.csv(googleSheetLink(INSTRUCTIONS_KEY, INSTRUCTIONS_GRAPHS_SHEET))
    .then(result => graphs = result)
    .catch(error => console.error(error)),
  d3.csv(googleSheetLink(INSTRUCTIONS_KEY, INSTRUCTIONS_TEMPLATES_SHEET))
    .then(result => templates = result)
    .catch(error => console.error(error)),
  d3.csv(googleSheetLink(INSTRUCTIONS_KEY, INSTRUCTIONS_OPTIONS_SHEET))
    .then(result => result.forEach(kv => options[kv.key] = kv.value))
    .catch(error => console.error(error)),
  d3.csv(googleSheetLink(INSTRUCTIONS_KEY, INSTRUCTIONS_GEOS_SHEET))
    .then(result => geos = result)
    .catch(error => console.error(error)),
  d3.csv(googleSheetLink(QUESTIONS_KEY, QUESTIONS_IGNOS_SHEET))
    .then(result => ignos = result)
    .catch(error => console.error(error))
]

// init readers
const fetch_concept_props = [];

const data_sources = {
  "open_numbers_sg": {dataset: "sg-master"},
  "open_numbers_wdi": {dataset: "wdi-master"}
}

Object.keys(data_sources).map(m => {
  const v = data_sources[m];
  v.reader = DDFServiceReader.getReader();
  v.reader.init({service: 'https://big-waffle.gapminder.org', name: v.dataset});
  v.conceptPromise = v.reader
    .read({select: {key: ["concept"], value: ["name"]}, from: "concepts"})
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
  DOM.graphsDownloadAll = DOM.nav.append("div").attr("class", "dl-all").text("Download all").on("click", () => downloadAll("graphs"));
  
  DOM.summary = DOM.container.append("div").attr("class", "summary");  
  DOM.render = DOM.container.append("div").attr("class", "render");
  
  
  graphs.forEach(graph => {
    DOM.graphs.append("span").append("a").text(graph.id + ",").on("click", ()=>{setUrlParams({graph: graph.id})});
  })
  

  let params = getUrlParams();
  let paramsEmpty = d3.keys(params).length == 0;
  DOM.nav.classed("invisible", !paramsEmpty);
  DOM.backButton.classed("invisible", paramsEmpty);
  
  
  function render (params){
    if (params.graph){
      let graph = graphs.find(f => f.id == params.graph);
      let geo = geos.find(f => f.geo_id == graph.geo_id);
      let template = templates.find(f => f.template_id == graph.id.split("_")[0]);
      makeLinechart({view: DOM.render, graph, data_sources, geo, template, options});
    }
  };
  
  render(params);
  
  
  function downloadAll() {
    graphs.forEach(graph => {

      let geo = geos.find(f => f.geo_id == graph.geo_id);
      let template = templates.find(f => f.template_id == graph.id.split("_")[0]);
      
      makeLinechart({view: DOM.render, graph, data_sources, geo, template, options})
        .then((svg)=>{
          downloadChart(svg, graph.id + ".png")
            .then(()=>svg.remove());
        });


    })
  }
  
  
  
  async function downloadChart(view, name){
    return saveSvgAsPng(view.node(), name);
  }
  
})





  
