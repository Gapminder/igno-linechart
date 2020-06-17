
export default function format(style, multiplier) {
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
    
    if(multiplier === "millions") d=d/1e6;
    if(multiplier === "billions") d=d/1e9;

    return d3.format(".2~s")(d).replace("G","B") + suffix;
  }
};
