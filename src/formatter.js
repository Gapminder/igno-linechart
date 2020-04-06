
export default function format(style) {
  return function(d){
    
    if(isNaN(d)) return d;
    
    let suffix = "";
    if (style == "PERCENT") {
      suffix = "%"
    }
    else if (style == "SHARE"){
      d = d*100;
      suffix = "%"
    }

    return d3.format(".2~s")(d) + suffix;
  }
};
