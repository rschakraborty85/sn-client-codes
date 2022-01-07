api.controller = function () {
  /* widget controller */
  var c = this;
  /**
   * @function init : set default values
   */
  function init() {
    c.howMany = 1;
    c.counter = [c.howMany];
    /**
     * @type array
     */
    c.datePickerArr = [
      {
        displayValue: "",
        value: "",
        name: "",
        id: "fromDate",
        placeholder: "Select date",
      },
    ];
    // vaccine definitions
    c.vaccineDefArr = [];
    c.vaccineDefItems = c.data.vaccineDefArr;
    // type options - full vs booster
    c.vaccineChoicesArr = [];
    c.vaccineChoicesItems = c.data.vaccineChoicesArr;
    c.vaccineChoices = "no";
    // common
    c.choiceOptions = {
      hideSearch: true,
    };
  }
  init();
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
  c.valueSelectedType = function (selectedValue, index) {};
};
