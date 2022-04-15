export async function savePng(view, name) {
  return saveSvgAsPng(view.node(), name, { scale: 2 });
}

export function saveSvg(view, name) {

  var ContainerElements = ["svg", "g", "defs", "marker"];
  var RelevantStyles = { "rect": ["fill", "stroke", "stroke-width"], "path": ["fill", "stroke", "stroke-width"], "marker": ["fill", "stroke", "stroke-width"], "circle": ["fill", "stroke", "stroke-width"], "line": ["stroke", "stroke-width"], "text": ["fill", "font-size", "text-anchor", "visibility", "font-family"], "polygon": ["stroke", "fill"] };


  function read_Element(ParentNode, OrigData) {
    var Children = ParentNode.childNodes;
    var OrigChildDat = OrigData.childNodes;

    for (var cd = 0; cd < Children.length; cd++) {
      var Child = Children[cd];

      var TagName = Child.tagName;
      if (ContainerElements.indexOf(TagName) != -1) {
        read_Element(Child, OrigChildDat[cd])
      } else if (TagName in RelevantStyles) {
        var StyleDef = window.getComputedStyle(OrigChildDat[cd]);

        var StyleString = "";
        for (var st = 0; st < RelevantStyles[TagName].length; st++) {
          StyleString += RelevantStyles[TagName][st] + ":" + StyleDef.getPropertyValue(RelevantStyles[TagName][st]) + "; ";
        }

        Child.setAttribute("style", StyleString);
      }
    }

  }

  function export_StyledSVG(SVGElem, name) {


    var oDOM = SVGElem.cloneNode(true)
    read_Element(oDOM, SVGElem)

    var data = new XMLSerializer().serializeToString(oDOM);
    var svg = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(svg);

    var link = document.createElement("a");
    link.setAttribute("target", "_blank");
    var Text = document.createTextNode("Export");
    link.appendChild(Text);
    link.download = name;
    link.href = url;

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