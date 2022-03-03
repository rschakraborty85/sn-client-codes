api.controller = function () {
  /* widget controller */
  var c = this;
  init();
  /**
   * @function init : set default values , on load
   */
  function init() {
    // vaccine definitions
    c.vaccineDefArr = [];
    c.vaccineDefItems = []; //c.data.vaccineDefArr;
    // type options - full vs booster
    c.vaccineChoicesArr = [];
    c.vaccineChoicesItems = c.data.vaccineChoicesArr;
    c.vaccineChoices = "no";
    // common
    c.choiceOptions = {
      hideSearch: true,
    };
    // console.log("RC vax response" + JSON.stringify(c.data.userVaxResponseArr));
    // check if user has existing records , if yes load them , if no - load empty row
    c.data.userVaxResponseArr.length > 0
      ? parseAndDisplayData(c.data.userVaxResponseArr)
      : function () {
          c.howMany = 1;
          c.counter = [c.howMany];
          c.datePickerArr = [
            {
              displayValue: "",
              value: "",
              name: "",
              id: "fromDate",
              placeholder: "Select date",
            },
          ];
        };
  }
  /**
   * @param {Array} objktArr
   * @returns {void}
   */
  function parseAndDisplayData(objktArr) {
    var flag = 0;
    c.counter = [];
    c.datePickerArr = [];
    c.howMany = objktArr.length;
    objktArr.forEach(function (item, index) {
      flag++;
      c.counter.push(flag);
      c.datePickerArr.push({
        displayValue: item.date_administered,
        value: item.date_administered,
        name: "",
        id: "fromDate",
        placeholder: "",
      });
      
    });
  }

  /**
   * @function addRow creates new elements and pushes to array
   * @returns void
   */
  c.addRow = function () {
    c.howMany++;
    c.counter.push(c.howMany);
    c.datePickerArr.push({
      displayValue: "",
      value: "",
      name: "",
      id: "fromDate",
      placeholder: "Select date",
    });
  };
  /**
   * @function selectDate
   * @param index index of array
   * @returns void
   */
  c.selectDate = function (index) {};

  /**
   * @function valueSelectedType
   * @param index index of array
   * @param selectedValue value selected in dropdown
   * @returns void
   */
  c.valueSelectedType = function (selectedValue, index) {
    // based on status reload vaccine def
    c.server
      .get({ action: "getVaxDef", ifBooster: selectedValue })
      .then(function (response) {
        // console.log(
        //   JSON.stringify(c.vaccineDefArr[index]) +
        //     "\n" +
        //     JSON.stringify(response.data)
        // );
        c.vaccineDefItems[index] = response.data.vaccineDefArr;
      });
  };
  /**
   * @function valueSelectedDef
   * @param index index of array
   * @param selectedValue value selected in dropdown
   * @returns void
   */
  c.valueSelectedDef = function (selectedValue, index) {};
};
