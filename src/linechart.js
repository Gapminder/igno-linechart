import format from "./formatter.js";

export default function makeLinechart({view, graph={}, data_sources={}, geo="", template="",  options}){

  const svg = view.append("svg").attr("class", "linechart");

  const indicator_id = graph.indicator;
  const dataset = graph.dataset;
  
  const timeStart = graph.time_interval.split("-")[0];
  const timeEnd = graph.time_interval.split("-")[1];
  const time_interval = {};
  if (!isNaN(timeStart)) time_interval["$gte"] = timeStart;
  if (!isNaN(timeEnd)) time_interval["$lte"] = timeEnd;
  
  return new Promise((resolve, reject) => {
  
    if(!data_sources[dataset]) reject(`Dataset ${dataset} is not listed`);
    if(!indicator_id) reject("Indicator not set");

    data_sources[dataset].reader
      .read({
        select: {
          key: ["geo", "time"], 
          value: [indicator_id]
        }, 
        where: {
          country: {"$in": [graph.geo_id]},
          time: time_interval
        }, 
        from: "datapoints"
      })
      .then(data => {
        linechart({
          data, 
          svg, 
          conceptProps: data_sources[dataset].concepts.find(c => c.concept == indicator_id),
          config: graph,
          options
        });
        resolve(svg);
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
  conceptProps = {concept: "lex", name: "Life expectancy"},
  config = {}
  options = {"chart title": "on"}
}
*/
export function linechart({data = [], svg, conceptProps = {}, config = {}, options = {}}){
  
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
    
    const PERCENT = conceptProps.format === "percent";
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
      .attr("dy","-30px")
      .attr("dx", -MARGIN.left + "px")
      .attr("class","title")
      .text(config.title);
    
    if(options["source text"] === "on") g.append("text")
      .attr("dy", HEIGHT + MARGIN.bottom - 10 + "px")
      .attr("dx", -MARGIN.left + "px")
      .attr("class","source")
      .text(config.source);
    
    //adds 10% of x axis domain from start and end
    function domainTimeBump(domain){
      const bump = parseInt(d3.timeYear.count(domain[0], domain[1]) / 10);
      return [d3.timeYear.offset(domain[0], -bump), d3.timeYear.offset(domain[1], bump)];
    }
  
    //adds 10% of y axis domain from start and end
    function domainLinearBump(domain){
      const bump = Math.abs(domain[0] - domain[1]) / 10;
      return [(domain[0] - bump), (domain[1] + bump)];
    }
    
    var xScale = d3.scaleTime()
      .domain(domainTimeBump(d3.extent(data.map(m => m.time))))
      .range([0, WIDTH]);
    
    let domain = [];
    if (config.y_domain) domain = JSON.parse(config.y_domain);
    else if (PERCENT) domain = [0,100];
    else domain = domainLinearBump(d3.extent(data.map(m => m[config.indicator])));
      
    var yScale = d3.scaleLinear()
      .domain(domain)
      .range([HEIGHT, 0]);
    
    var line = d3.line()
      .x(function(d) { return xScale(d.time); }) 
      .y(function(d) { return yScale(d[config.indicator]); }) 
      .curve(d3.curveLinear);
    
    g.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + HEIGHT + ")")
      .call(d3.axisBottom(xScale).ticks(5).tickSizeOuter(0));
    
    g.append("g")
      .attr("class", "y axis")
      .call(d3.axisLeft(yScale).tickFormat(formatter).ticks(5).tickSizeOuter(0)); 
    
    g.append("path")
      .datum(data) 
      .attr('marker-start', (d) => "url(#cicle)")//attach the arrow from defs
      .attr('marker-end', (d) => "url(#arrow)")//attach the arrow from defs
      .attr("class", "line") 
      .attr("d", line);
    
    
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
        .attr("dy", -20 + parseInt(dy) + "px")
        .attr("dx", dx + "px")
        .attr("x", x)
        .attr("y", y)
        .text(text)
    }
    
    config.reference_values.forEach(addReference);
    
    const endTime = d3.max(data.map(m => m.time));
    const endValue = data.find(f => f.time - endTime == 0)[config.indicator];
    const upperHalfEndValue = yScale(endValue) < HEIGHT/2;
    
    g.append("text")
      .attr("class", "endvalue")
      .attr("text-anchor", "start")
      .attr("dy", config.endvalue_dy || 0 + "px")
      .attr("dx", config.endvalue_dx || 0 + "px")
      .attr("x", xScale(endTime))
      .attr("y", yScale(endValue) + (upperHalfEndValue? 50 : -30) + "px")
      .style("visibility", config.endvalue=="off" ? "hidden" : null)
      .text(config.endvalue || formatter(endValue))
    
    const startTime = d3.min(data.map(m => m.time));
    const startValue = data.find(f => f.time - startTime == 0)[config.indicator];
    const upperHalfStartValue = yScale(startValue) < HEIGHT/2;
    
    g.append("text")
      .attr("class", "startvalue")
      .attr("text-anchor", "start")
      .attr("dy", config.startvalue_dy || 0 + "px")
      .attr("dx", config.startvalue_dx || 0 + "px")
      .attr("x", xScale(startTime))
      .attr("y", yScale(startValue) + (upperHalfStartValue? 50 : -30) + "px")
      .style("visibility", config.startvalue=="off" ? "hidden" : null)
      .text(config.startvalue || formatter(startValue))
    
    g.append("text")
      .attr("class", "multiplier")
      .attr("text-anchor", "start")
      .attr("dy", "10px")
      .attr("dx", "10px")
      .attr("x", 0)
      .attr("y", 0)
      .text(config.multiplier)
  }
  
  

}