import format from "./formatter.js";

export default function makeLinechart({view, graph={}, data_sources={}, geo="", template="", igno = {}, options}){

  const svg = view.append("svg").attr("class", "linechart");

  const measure_id = graph.indicator.split("@")[0];
  const dataset = graph.indicator.split("@")[1];
  
  return new Promise((resolve, reject) => {
  
    if(!data_sources[dataset]) {
      reject(`Dataset ${dataset} is not listed`)
    } else {

      data_sources[dataset].reader
        .read({select: {key: ["geo", "time"], value: [measure_id]}, where: {country: {"$in": [graph.geo_id]}}, from: "datapoints"})
        .then(data => {
          linechart({
            measure_id, 
            geo_id: graph.geo_id, 
            data, 
            svg, 
            geoProps: geo,
            conceptProps: data_sources[dataset].concepts.find(c => c.concept == measure_id),
            template,
            igno,
            options
          });
          resolve(svg);
        })
        .catch(error => console.error(error))
    }
  
  });

  
}

/*
example: {
  measure_id = "lex", 
  geo_id = "rwa", 
  data = [
    {time: Mon Apr 06 2020 22:18:51 GMT+0200 (Central European Summer Time), geo: rwa, lex: 68},
    {...}
  ], 
  svg = d3-selected SVG DOM element. like so: d3.select("svg"), 
  geoProps = {geo: "rwa", name: "Rwanda"},
  conceptProps = {concept: "lex", name: "Life expectancy"},
  template = {data coming from spreadsheet about template questions},
  igno = {data coming from spreadsheet about particular igno questions, needed to make reference lines},
  options = {"chart title": "on"}
}
*/
export function linechart({measure_id = "", geo_id = "", data = [], svg, geoProps = {}, conceptProps = {}, template = {}, igno = {}, options = {}}){
  const MARGIN = {top: 50, right: 200, bottom: 50, left: 75}
  const WIDTH = 640 - MARGIN.left - MARGIN.right;
  const HEIGHT = 480 - MARGIN.top - MARGIN.bottom;  
  
  svg
    .attr("width", WIDTH + MARGIN.left + MARGIN.right + "px")
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom + "px")
  
  if (!data.length) {
    svg.append("text")
      .attr("dy", "20px")
      .text(`EMPTY DATA for ${template["template short name"]} and ${geo_id}`).style("fill", "red");
    
  } else {
    
    const PERCENT = template["template short name"].includes("%");
    let formatter = format(PERCENT? "PERCENT" : "");
    
    svg.append("svg:defs").append("svg:marker")
      .attr("id", "arrow")
      .attr("viewBox", "-10 -7 12 12")
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("svg:path")
      .attr("d", "M-7,-4L1,0L-7,4");
    
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
    
    if(options["chart title"] === "on") g.append("text").attr("dy","-10px").text(conceptProps.name + " in " + geoProps.name);
    
    //adds 10% of x axis domain from start and end
    function domainBump(domain){
      const bump = parseInt(d3.timeYear.count(domain[0], domain[1]) / 10);
      return [d3.timeYear.offset(domain[0], -bump), d3.timeYear.offset(domain[1], bump)];
    }
    
    var xScale = d3.scaleTime()
      .domain(domainBump(d3.extent(data.map(m => m.time))))
      .range([0, WIDTH]);
    
    var yScale = d3.scaleLinear()
      .domain(PERCENT ? [0,100] : d3.extent(data.map(m => m[measure_id])))
      .range([HEIGHT, 0]);
    
    var line = d3.line()
      .x(function(d) { return xScale(d.time); }) 
      .y(function(d) { return yScale(d[measure_id]); }) 
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
    
    
    function addReference({view, text, cssClass, yValue}) {
      
      let y = yScale(yValue);
    
      view.append("line")
        .attr("class", "option " + cssClass)
        .attr("x1", WIDTH)
        .attr("x2", WIDTH + MARGIN.right)
        .attr("y1", y)
        .attr("y2", y)
      
      view.append("text")
        .attr("class", "option " + cssClass)
        .attr("text-anchor", "end")
        .attr("dy", -5)
        .attr("dx", -4)
        .attr("x", WIDTH + MARGIN.right)
        .attr("y", y)
        .text(text)
    }
    
    if (d3.keys(igno).length) {
      addReference({view: g, text: "Correct", cssClass: "correct", yValue: igno[igno.correct] * (PERCENT ? 100 : 1)});
      addReference({view: g, text: "Wrong", cssClass: "wrong", yValue: igno[igno.wrong] * (PERCENT ? 100 : 1)});
      addReference({view: g, text: "Very wrong", cssClass: "vwrong", yValue: igno[igno["very wrong"]] * (PERCENT ? 100 : 1)});
    }
    
    const endTime = d3.max(data.map(m => m.time));
    const endValue = data.find(f => f.time - endTime == 0)[measure_id];
    const upperHalf = yScale(endValue) < HEIGHT/2;
    
    g.append("text")
      .attr("class", "endvalue")
      .attr("text-anchor", "start")
      .attr("dy", upperHalf? "50px" : "-30px")
      .attr("dx", 0)
      .attr("x", xScale(endTime))
      .attr("y", yScale(endValue))
      .text(formatter(endValue))
  }

}