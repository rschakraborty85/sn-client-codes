(function () {
  /* populate the 'data' object */
  /* e.g., data.table = $sp.getValue('table'); */

  // on load functions
  getStatusChoices();
  getVaccineDef();
  loadExistingData();

  if (input) {
    if (input.action == "getVaxDef") {
      getVaccineDef(input.ifBooster);
    }
  }
  /**
   * @returns {Object}
   */
  function loadExistingData() {
    var vaxResponse = new GlideRecord("sn_imt_vaccine_vaccine_response");
    vaxResponse.addQuery("profile", getUserVaxProfile());
    vaxResponse.orderBy("date_administered");
    vaxResponse.query();
    data.userVaxResponseArr = [];
    while (vaxResponse.next()) {
      data.userVaxResponseArr.push({
        vaccine_response_definition:
          vaxResponse.vaccine_response_definition + "",
        vaccine_response_definition_display: vaxResponse.vaccine_response_definition.getDisplayValue(),
        date_administered: vaxResponse.date_administered + "",
        been_vaccinated: vaxResponse.getValue("been_vaccinated") + "",
        been_vaccinated_display: vaxResponse.been_vaccinated.getDisplayValue(),
      });
    }
  }
  /**
   *
   * @returns {String} profile sys_id
   */
  function getUserVaxProfile() {
    var profile = new GlideRecord("sn_imt_vaccine_vaccine_profile");
    profile.get("user", gs.getUserID());
    return profile.getUniqueValue();
  }
  /**
   * @function getStatusChoices
   * @returns {JSON}
   */
  function getStatusChoices() {
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
  /**
   * @function getVaccineDef
   * @param {String} ifBooster
   * @returns {JSON}
   */
  function getVaccineDef(ifBooster) {
    var vaccineGR = new GlideRecord(
      "sn_imt_vaccine_vaccine_response_definition"
    );
    // if its booster dose only show booster data otherwise vaccine
    if (ifBooster) {
      if (ifBooster.indexOf("booster") > -1)
        vaccineGR.addQuery("vaccine_type", "booster_vaccine");
      else
        vaccineGR.addEncodedQuery(
          "vaccine_type!=booster_vaccine^ORvaccine_type=NULL"
        );
    }
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
