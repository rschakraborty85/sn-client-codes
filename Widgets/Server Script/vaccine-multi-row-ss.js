(function () {
  /* populate the 'data' object */
  /* e.g., data.table = $sp.getValue('table'); */
  getChoices();
  getVaccineDef();
  function getChoices() {
    var choicesGR = new GlideRecord("sys_choice");
    var query =
      "name=sn_imt_vaccine_vaccine_response^element=been_vaccinated^inactive=false" +
      "^language=en^value!=no^ORvalue=NULL^value!=prefer_not_to_say^ORvalue=NULL";
    choicesGR.addEncodedQuery(query);
    choicesGR.orderBy("sequence");
    choicesGR.query();
    data.vaccineChoicesArr = [];
    while (choicesGR.next()) {
      data.vaccineChoicesArr.push({
        display: choicesGR.label + "",
        value: choicesGR.value + "",
      });
    }
  }
  function getVaccineDef() {
    var vaccineGR = new GlideRecord(
      "sn_imt_vaccine_vaccine_response_definition"
    );
    vaccineGR.orderBy("manufacturer");
    vaccineGR.query();
    data.vaccineDefArr = [];
    while (vaccineGR.next()) {
      data.vaccineDefArr.push({
        type: vaccineGR.vaccine_type + "",
        manufacturer: vaccineGR.manufacturer + "",
        doses_required: vaccineGR.doses_required + "",
      });
    }
  }
})();
