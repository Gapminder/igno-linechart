import format from "./formatter.js";
import {savePng, saveSvg} from "./download-utils.js"

export default function makeLinechart({view, graph={}, data_sources={}, geo="", template="",  options}){

  const render = view.append("div");
  const svg = render.append("svg").attr("class", "linechart");
  render.append("div")
    .attr("class", "dl-all")
    .text("Download as PNG")
    .on("click", () => savePng(svg, graph.id + " - " + graph.title + ".png"));
  render.append("div")
    .attr("class", "dl-all")
    .text("Download as SVG")
    .on("click", () => saveSvg(svg, graph.id + " - " + graph.title + ".svg"));

  const indicator_id = graph.indicator;
  const dataset = graph.dataset;
  
  const timeStart = graph.time_interval.split("-")[0];
  const timeEnd = graph.time_interval.split("-")[1];
  const time_interval = {};
  if (!isNaN(timeStart)) time_interval["$gte"] = timeStart;
  if (!isNaN(timeEnd)) time_interval["$lte"] = timeEnd;
  
  return new Promise((resolve, reject) => {
  
    if(!dataset) reject(`Dataset of graph ${graph.id} is not specified`);
    if(!data_sources[dataset] && !dataset.includes("google")) reject(`Dataset ${dataset} is not listed`);

    const readerPromise = dataset.includes("google")
      ? data_sources["google-spreadsheet"].reader.read(dataset)
      : data_sources[dataset].reader.read({
        select: {
          key: ["geo", "time"], 
          value: [indicator_id]
        }, 
        where: {
          country: {"$in": [graph.geo_id]},
          time: time_interval
        }, 
        from: "datapoints"
      });

    readerPromise
      .then(data => {  
          linechart({
            data, 
            svg, 
            config: graph,
            options
          });
          resolve(render);
        })
      .catch(error => console.error(error))  
  });
}

/*
example: {
  data = [
    {time: Mon Apr 06 2020 22:18:51 GMT+0200 (Central European Summer Time), geo: rwa, lex: 68},
    {...}
  ], 
  svg = d3-selected SVG DOM element. like so: d3.select("svg"), 
  config = {}
  options = {"chart title": "on"}
}
*/
export function linechart({data = [], svg, config = {}, options = {}}){
  
  config = Object.assign({
    
    id: "",
    geo_id: "",
    indicator: "",
    dataset: "",
    title: "",
    source: "",
    y_domain: "",
    time_interval: "",
    reference_values: "",
    multiplier: "",
    startvalue: "",
    endvalue: "",
    startvalue_dx: "",
    endvalue_dx: "",
    startvalue_dy: "",
    endvalue_dy: ""
  }, config);
  
  config.reference_values = JSON.parse(config.reference_values || "[]");
  config.indicator = config.indicator || "y";
  
  const MARGIN = {
    top: parseInt(options["margin top"]) || 20, 
    bottom: parseInt(options["margin bottom"]) || 35, 
    left: parseInt(options["margin left"]) ||  80,
    right: parseInt(options["margin right"]) || 65 
  }
  const WIDTH = 654 - MARGIN.left - MARGIN.right;
  const HEIGHT = 462 - MARGIN.top - MARGIN.bottom;  
  
  svg
    .attr("width", WIDTH + MARGIN.left + MARGIN.right + "px")
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom + "px")
  
  if (!data.length) {
    svg.append("text")
      .attr("dy", "20px")
      .text(`EMPTY DATA for ${config.title} and ${config.geo_id}`).style("fill", "red");
    
  } else {
    
    const PERCENT = config.format === "percent";
    let formatter = format(PERCENT? "PERCENT" : "", config.multiplier);
    
    svg.append("svg:defs").append("svg:marker")
      .attr("id", "arrow")
      .attr("viewBox", "-8 -7 12 12")
      .attr("refX", "-7px")
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .style("stroke-linejoin", "round")
      .style("stroke-width", "3px")
      .append("svg:path")
      .attr("d", "M-6,-3L1,0L-6,3Z");
    
    svg.append("svg:defs").append("svg:marker")
      .attr("id", "cicle")
      .attr("viewBox", "-5 -5 12 12")
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("svg:circle")
      .attr("r", 3)
      .attr("x0", 0)
      .attr("y0", 0);
    
    const g = svg.append("g")
      .attr("transform", "translate(" + MARGIN.left + "," + MARGIN.top + ")");
    
    if(options["chart title"] === "on") g.append("text")
      .attr("y","-30px")
      .attr("x", -MARGIN.left + "px")
      .attr("class","title")
      .text(config.title);
    
    if(options["source text"] === "on") g.append("text")
      .attr("y", HEIGHT + MARGIN.bottom - 10 + "px")
      .attr("x", -MARGIN.left + "px")
      .attr("class","source")
      .text(config.source);
    
    //adds 10% of x axis domain from start and end
    function domainTimeBump(domain, timeBump){
      if (!timeBump) return domain;
      const bump = parseInt(d3.timeYear.count(domain[0], domain[1]) / timeBump);
      return [d3.timeYear.offset(domain[0], -bump), d3.timeYear.offset(domain[1], bump)];
    }
  
    //adds 10% of y axis domain from start and end
    function domainLinearBump(domain){
      const bump = Math.abs(domain[0] - domain[1]) / 10;
      return [(domain[0] - bump), (domain[1] + bump)];
    }
    
    let dataTimeLimits = d3.extent(data.map(m => m.time));
    var xScale = d3.scaleTime()
      .domain(domainTimeBump(dataTimeLimits, +options["time bump"]))
      .range([0, WIDTH]);
    
    let domain = [];
    if (config.y_domain) domain = JSON.parse(config.y_domain);
    //else if (PERCENT) domain = [0,100];
    else domain = domainLinearBump(d3.extent(data.map(m => m[config.indicator])));
      
    var yScale = d3.scaleLinear()
      .domain(domain)
      .range([HEIGHT, 0]);
    
    var line = d3.line()
      .x(function(d) { return xScale(d.time); }) 
      .y(function(d) { return yScale(d[config.indicator]); }) 
      .curve(d3.curveLinear);

    var area = d3.area()
      .x(function(d) { return xScale(d.time); }) 
      .y1(function(d) { return yScale(d[config.indicator]); }) 
      .y0(function(d) { return yScale(yScale.domain()[0]); }) 
      .curve(d3.curveLinear);

    g.append("path")
      .datum(data) 
      .attr("class", "area") 
      .attr("d", area)
      .style("fill", options["area color"]);

    g.append("path")
      .datum(data) 
      .attr('marker-start', (d) => options.dot === "on" ? "url(#cicle)" : null)//attach the arrow from defs
      .attr('marker-end', (d) => options.dot === "on" ? "url(#arrow)" : null)//attach the arrow from defs
      .attr("class", "line") 
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("d", line)
      .style("stroke", options["line color"]);
    
    g.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + HEIGHT + ")")
      .call(
        d3.axisBottom(xScale)
          .ticks(3)
          .tickSizeOuter(0)
          .tickValues([dataTimeLimits[0], d3.interpolateDate(dataTimeLimits[0], dataTimeLimits[1])(0.5), dataTimeLimits[1]])
          .tickFormat(d3.timeFormat("%Y"))
      )
      .selectAll("text")
        .attr("dy", null)
        .attr("y", options["x axis ticks dy"] + "px")
        .each(function(d, i){
          const view = d3.select(this);
          if (i===0) view.attr("text-anchor", "start");
          if (i===2) view.attr("text-anchor", "end");

        });

    if(options["y axis"] === "on") g.append("g")
      .attr("class", "y axis")
      .call(d3.axisLeft(yScale).tickFormat(formatter).ticks(5).tickSizeOuter(0)); 
    
    
    function addReference({time, value, text="", dx=0, dy=0, cssClass="reference"}) {
      
      let y = yScale(value);
      let x = xScale(new Date(time+""));
    
      g.append("circle")
        .attr("class", "option " + cssClass)
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", 10);
      
      g.append("text")
        .attr("class", "option " + cssClass)
        .attr("text-anchor", "middle")
        .attr("x", x + dx + "px")
        .attr("y", y - 20 + parseInt(dy) + "px")
        .text(text)
    }
    
    config.reference_values.forEach(addReference);
    
    const endTime = d3.max(data.map(m => m.time));
    const endValue = data.find(f => f.time - endTime == 0)[config.indicator];
    const upperHalfEndValue = yScale(endValue) < HEIGHT/2 && options.area === "off";
    
    g.append("text")
      .attr("class", "endvalue")
      .attr("text-anchor", "start")
      .attr("x", xScale(endTime) + config.endvalue_dx || 0 + "px")
      .attr("y", yScale(endValue) + (upperHalfEndValue? 50 : -30) + config.endvalue_dy || 0 + "px")
      .style("visibility", config.endvalue=="off" ? "hidden" : null)
      .text(config.endvalue || formatter(endValue))
    
    const startTime = d3.min(data.map(m => m.time));
    const startValue = data.find(f => f.time - startTime == 0)[config.indicator];
    const upperHalfStartValue = yScale(startValue) < HEIGHT/2 && options.area === "off";
    
    g.append("text")
      .attr("class", "startvalue")
      .attr("text-anchor", "start")
      .attr("x", xScale(startTime) + config.startvalue_dx || 0 + "px")
      .attr("y", yScale(startValue) + (upperHalfStartValue? 50 : -30) + config.startvalue_dy || 0 + "px")
      .style("visibility", config.startvalue=="off" ? "hidden" : null)
      .text(config.startvalue || formatter(startValue))
    
    g.append("text")
      .attr("class", "multiplier")
      .attr("text-anchor", "start")
      .attr("x", -MARGIN.left + "px")
      .attr("y", "10px")
      .text((config.subtitle || "") + (config.subtitle && config.multiplier && ", " || "") + (config.multiplier || ""))
  }
  
  

}