



import {AVisInstance} from "../caleydo_core/vis";
import {SimHash} from "./simhash"
import {isUndefined, indexOf, mod} from "../caleydo_core/main";

interface Weight {
  name;
  value;
  color;
  active;
}


export class LinupStateView {
  protected container;

  constructor(container) {
    this.container = container;
    this.initialize()

    return this;
  }

  initialize() {
    
  }


}

export class WeightInterface {

  protected weights:Weight[] = [];
  protected cats = ["data", "visual", "selection", "layout", "analysis"]
  protected cumSum:number[] = []
  protected scalefactor:number = (300 - 4) / 100

  protected catContainer;
  protected barContainer;
  protected faString:string[] = ["fa-database", "fa-bar-chart", "fa-pencil-square", "fa-desktop", "fa-gear"]

  protected closeWeightSelection;
  protected openWeightSelection;

  constructor(container) {
    this.catContainer = container;
    this.barContainer = this.catContainer.select(".barContainer")
    let rawWeights = SimHash.hasher.categoryWeighting;
    this.cumSum[0] = 0
    for (var i = 1; i <= rawWeights.length; i++) {
      this.cumSum[i] = this.cumSum[i - 1] + rawWeights[i - 1]
    }
    var cols = ['#e41a1c', '#377eb8', '#984ea3', '#ffff33', '#ff7f00']
    this.weights[0] = {name: this.cats[0], value: rawWeights[0], color: cols[0], active: true}
    this.weights[1] = {name: this.cats[1], value: rawWeights[1], color: cols[1], active: true}
    this.weights[2] = {name: this.cats[2], value: rawWeights[2], color: cols[2], active: true}
    this.weights[3] = {name: this.cats[3], value: rawWeights[3], color: cols[3], active: true}
    this.weights[4] = {name: this.cats[4], value: rawWeights[4], color: cols[4], active: true}

    //this.update(false);
    this.initialize()
    return this;
  }

  public close() {
    this.closeWeightSelection()
  }

  protected catsWeightMap(name):Weight {
    return this.weights[this.cats.indexOf(name)]
  }

  protected getNextActive(index) {
    let nextIndex = -1
    for (var i = 1; i < this.weights.length; i++) {
      if (this.weights[mod(index + i, 5)].active) {
        nextIndex = mod(index + i, 5)
        break;
      }
    }
    return nextIndex
  }

  protected getPreviousActive(index) {
    let nextIndex = -1
    for (var i = 1; i < this.weights.length; i++) {
      if (this.weights[mod(index - i, 5)].active) {
        nextIndex = mod(index - i, 5)
        break;
      }
    }
    return nextIndex
  }

  protected shadeColor(color, percent) {
    var f = parseInt(color.slice(1), 16), t = percent < 0 ? 0 : 255, p = percent < 0 ? percent * -1 : percent, R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
  }

  protected update(transitions:boolean) {
    let _that = this;
    let transitionDuration = 300;
    let bars = this.barContainer.selectAll("div")
      .data(this.weights, function (d) {
        return d.name;
      })
    let lines = this.catContainer.selectAll("line")
      .data(this.weights, function (d) {
        return d.name;
      })

    //update


    //enter
    bars.enter()
      .append("div")
      .classed("bar", true)
      .classed("adjustable", true)
    lines.enter()
      .append("line")
      .style("stroke", function (d) {
        return d.color
      })

    //update+enter
    let b = <any>bars
    if (transitions) b = <any>bars.transition().duration(transitionDuration)
    b.style("left", "0px")
      .style("height", function (d) {
        return d.value * _that.scalefactor + "px";
      })
      .style("top", function (d, i) {
        return _that.cumSum[i] * _that.scalefactor + "px"
      })
      .style("width", "30px")
      .text("")


    let l = <any>lines
    if (transitions) l = <any>lines.transition().duration(transitionDuration)
    l.style("stroke", function (d) {
        return d.color
      })
      .attr("y1", function (d, i) {
        return (_that.cumSum[i] + _that.cumSum[i + 1]) / 2 * _that.scalefactor + 10
      })
      .attr("y2", function (d, i) {
        return i * 26 + 90 + 13
      })
      .attr("x1", "50")
      .attr("x2", "120")
      .style("opacity", function (d) {
        return d.active ? 1 : 0
      })


    d3.selectAll('.categoryUnit label').transition()
      .delay(transitionDuration)
      .style("background-color", function () {
        return _that.shadeColor(_that.catsWeightMap($(this).attr("title")).color, 0.3)
      })


    //set weights
    let w = [0, 0, 0, 0, 0]
    w[_that.cats.indexOf(_that.weights[0].name)] = _that.weights[0].value
    w[_that.cats.indexOf(_that.weights[1].name)] = _that.weights[1].value
    w[_that.cats.indexOf(_that.weights[2].name)] = _that.weights[2].value
    w[_that.cats.indexOf(_that.weights[3].name)] = _that.weights[3].value
    w[_that.cats.indexOf(_that.weights[4].name)] = _that.weights[4].value
    SimHash.hasher.categoryWeighting = w

    //update handlePos
    let handles = this.catContainer.selectAll(".chart_handle")
    let h = <any>handles
    if (transitions) h = <any>handles.transition().duration(transitionDuration)
    h.style("left", "10px")
      .style("top", function (d, i) {
        return _that.cumSum[i + 1] * _that.scalefactor + "px"
      })
      .style("opacity", function (d) {
        let setActive = _that.catsWeightMap($(this).attr('id')).active;
        let index = _that.cats.indexOf($(this).attr('id'))
        if (_that.getNextActive(index) <= index) setActive = false;
        return setActive ? 1 : 0;
      })
      .style("z-index", function (d) {
        return _that.catsWeightMap($(this).attr('id')).active ? 4 : -4;
      })

    //update textfields
    let label = <any>d3.selectAll(".categoryUnit input.catValue")
    if (transitions) label = label.transition().duration(transitionDuration)
    label.attr("value", function () {
      return Math.round(_that.catsWeightMap($(this).attr('id')).value) / 100
    })
  }


  initialize() {
    let _that = this;
    let categoryUnit = function (catName:string, defaultWeight:number, faString:string):string {
      let capitalizeFirstLetter = function (string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
      }
      return (
      "<div class='categoryUnit' id='" + catName + "'>" +
      "<input class='catValue' type='number' min='0' max='1' value='" + defaultWeight / 100 + "' id='" + catName + "'></input>" +
      "<label class='btn btn-default btn-xs' title='" + catName + "'>" +
      "<input type='checkbox' autocomplete='off' name='category' value='" + catName + "'> <i class='fa " + faString + "'></i>" + capitalizeFirstLetter(catName) +
      "</label>" +
      "</div>")
    }

    $(".controlContainer").append(categoryUnit(this.weights[0].name, this.weights[0].value, this.faString[0]))
    $(".controlContainer").append(categoryUnit(this.weights[1].name, this.weights[1].value, this.faString[1]))
    $(".controlContainer").append(categoryUnit(this.weights[2].name, this.weights[2].value, this.faString[2]))
    $(".controlContainer").append(categoryUnit(this.weights[3].name, this.weights[3].value, this.faString[3]))
    $(".controlContainer").append(categoryUnit(this.weights[4].name, this.weights[4].value, this.faString[4]))
    $('.provenance-similarity-vis').hide();

    $('.categoryUnit label input[type=checkbox]').prop('checked', true);

    let handleHtml = function (id:string) {
      return (
      "<div class='chart_handle' id='" + id + "'>" +
      "<i class='fa fa-arrow-right' aria-hidden='true'></i>" +
      "</div>")
    }

    $(".catWeightContainer").append(handleHtml(this.cats[0]))
    $(".catWeightContainer").append(handleHtml(this.cats[1]))
    $(".catWeightContainer").append(handleHtml(this.cats[2]))
    $(".catWeightContainer").append(handleHtml(this.cats[3]))

    var dragResize = d3.behavior.drag()
      .on('drag', function () {
        let x = d3.mouse(_that.barContainer.node())[1] / _that.scalefactor;
        if (x > 100) x = 100
        let id = _that.cats.indexOf($(this).attr("id"))
        let diff = _that.cumSum[id + 1] - x
        _that.weights[id].value -= diff
        let next = _that.getNextActive(id)
        let prev = _that.getPreviousActive(id)
        let isLast = next <= id
        if (next <= id) {
          _that.weights[prev].value += diff
        } else {
          _that.weights[next].value += diff
        }

        _that.cumSum[0] = 0
        for (var i = 1; i <= _that.weights.length; i++) {
          _that.cumSum[i] = _that.cumSum[i - 1] + _that.weights[i - 1].value
        }
        _that.update(false)
        SimHash.hasher.fire("weights_changed")
        //that.update()
      });
    d3.selectAll(".chart_handle").call(dragResize);


    this.closeWeightSelection = function () {
      let _that = this;
      $(".controlContainer").hide()
      d3.select(".controlContainer").transition()
        .duration(150)
        .style("opacity", 0)
      this.barContainer.style("width", "280px")
        .transition()
        .style("left", "0px")
        .style("top", "0px")
        .style("width", "300px")
      this.catContainer.transition()
        .delay(300)
        .duration(400)
        .style("background-color", "#60AA85").each(function () {
        _that.catContainer.classed("closed", true)
          .classed("open", false)
      })
      this.catContainer.transition()
        .delay(75)
        .duration(100)
        .style("height", "22px")
      this.catContainer.selectAll(".chart_handle").transition()
        .style("opacity", 0)
        .duration(100)
        .each(function () {
          $(".chart_handle").hide()
        })
      d3.select(".lineContainer").transition()
        .duration(100)
        .style("opacity", 0)
        .each(function () {
          $("lineContainer").hide()
        })
      d3.select(".lineContainer").transition()
        .delay(75)
        .duration(100)
        .style("height", "22px")
      this.barContainer.selectAll(".adjustable").transition()
        .text(function (d, i) {
          return (_that.cats[i] + " " + Math.round(d.value) + "%");
        })
        .style("top", "0px")
        .style("left", function (d, i) {
          return _that.cumSum[i] * _that.scalefactor + "px"
        })
        .style("width", function (d) {
          return d.value * _that.scalefactor + "px";
        })
        .style("height", "22px")
        .style("background-color", function (d, i) {
          return d.color
        })
        //.style("opacity", 0.8)
        .style("color", function (d, i) {
          return i >= 3 ? "black" : "white"
        })
      //.duration(2500)
      this.barContainer.selectAll(".adjustable")
        .classed("compact", true)
        .classed("adjustable", false)
    }.bind(this)

    this.openWeightSelection = function () {
      let _that = this;
      $(".controlContainer").show()
      $(".lineContainer").show()
      d3.select(".lineContainer").transition()
        .delay(150)
        .duration(150)
        .style("height", "300px")
        .style("opacity", 1)
      d3.select(".controlContainer").transition()
        .delay(150)
        .duration(150)
        .style("opacity", 1)
      $(".chart_handle").show()
      this.catContainer.selectAll(".chart_handle")
        .transition()
        .delay(150)
        .duration(150)
      this.barContainer.style("width", "30px")
        .transition()
        .style("left", "20px")
        .style("top", "10px")
      this.catContainer.transition()
        .style("height", "320px")
      this.barContainer.selectAll(".compact").transition()
        .style("left", "0px")
        .style("height", function (d) {
          return d.value * _that.scalefactor + "px";
        })
        .style("top", function (d, i) {
          return _that.cumSum[i] * _that.scalefactor + "px"
        })
        .style("width", "30px")
        .text("")
      //.duration(1500)
      this.barContainer.selectAll(".compact")
        .classed("compact", false)
        .classed("adjustable", true)
      this.catContainer.classed("closed", false)
        .classed("open", true)
      this.update(true)
    }.bind(this)

    this.closeWeightSelection()
    this.update(false)
    this.catContainer.on('click', this.openWeightSelection)
    this.catContainer.on('mouseleave', this.closeWeightSelection)

    d3.selectAll(".categoryUnit label input").on('change', function () {
      let index = _that.cats.indexOf($(this).attr("value"))
      if (_that.weights[index].active) {
        //deactivate
        _that.weights[_that.getNextActive(index)].value += _that.weights[index].value
        _that.weights[index].value = 0
      } else {
        //activate
        let nextIndex = _that.getNextActive(index)
        if (nextIndex < 0) {
          _that.weights[index].value = 100
        } else {
          let val = _that.weights[nextIndex].value
          _that.weights[index].value = val / 2
          _that.weights[nextIndex].value = val / 2
        }
      }
      _that.weights[index].active = !_that.weights[index].active
      _that.cumSum[0] = 0
      for (var i = 1; i <= _that.weights.length; i++) {
        _that.cumSum[i] = _that.cumSum[i - 1] + _that.weights[i - 1].value
      }
      _that.update(true)
      SimHash.hasher.fire("weights_changed")
      //that.update();
    })
  }
}

