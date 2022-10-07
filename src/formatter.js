
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
    
    if(multiplier === "thousands") d=d/1e3;
    if(multiplier === "millions") d=d/1e6;
    if(multiplier === "billions") d=d/1e9;

    return d3.formatLocale({
      decimal: ".",
      thousands: " ",
      grouping: [3],
    }).format(',.2r')(d) + suffix;
  }
};
