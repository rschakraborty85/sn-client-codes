var VaccinationStatusUtilAJAXProcessor = Class.create();
VaccinationStatusUtilAJAXProcessor.prototype = Object.extendsObject(
  global.AbstractAjaxProcessor,
  {
    getVaccineStatus: function () {
      var vaccineStatus = "";
      var vaccineResponseGr = new GlideRecord(
        "sn_imt_vaccine_vaccine_response"
      );
      vaccineResponseGr.addEncodedQuery("profile.user=" + gs.getUserID());

      vaccineResponseGr.query();
      if (vaccineResponseGr.next()) {
        if (vaccineResponseGr.been_vaccinated == "yes") {
          vaccineStatus = "Fully Vaccinated";
        } else if (
          vaccineResponseGr.been_vaccinated == "in_progress" ||
          vaccineResponseGr.been_vaccinated == "no" ||
          vaccineResponseGr.been_vaccinated == "prefer_not_to_say"
        ) {
          vaccineStatus = "In Progress";
        }
      } else {
        vaccineStatus = "Not Recorded";
      }
      var result = this.newItem("result");
      result.setAttribute("vaccine_status", vaccineStatus);
      result.setAttribute("is_mobile", gs.isMobile());
    },

    getVaccineStatusForWidget: function () {
      var vaccineStatus = "";
      var vaccineResponseGr = new GlideRecord(
        "sn_imt_vaccine_vaccine_response"
      );
      vaccineResponseGr.addEncodedQuery("profile.user=" + gs.getUserID());

      vaccineResponseGr.query();
      if (vaccineResponseGr.next()) {
        if (vaccineResponseGr.been_vaccinated == "yes") {
          vaccineStatus = "Fully Vaccinated";
        } else if (
          vaccineResponseGr.been_vaccinated == "in_progress" ||
          vaccineResponseGr.been_vaccinated == "no" ||
          vaccineResponseGr.been_vaccinated == "prefer_not_to_say"
        ) {
          vaccineStatus = "In Progress";
        }
      } else {
        vaccineStatus = "Not Recorded";
      }
      return vaccineStatus;
    },

    // vaccine Exemption Required False
    getVaccineResponseVaccineStatus: function (
      vaccineStatus,
      submission,
      user
    ) {
      var returnObj = {
        isAllowed: false,
        reason: "",
      };

      var vaccineResponseGr = new GlideRecord(
        "sn_imt_vaccine_vaccine_response"
      );
      vaccineResponseGr.addEncodedQuery("profile.user=" + user);
      vaccineResponseGr.orderByDesc("sys_updated_on");
      vaccineResponseGr.query();
      if (vaccineResponseGr.next()) {
        if (submission == "employee_with_specific_value") {
          var allowedvaccineStatus = vaccineStatus;
          var responseVaccneStatus = vaccineResponseGr.been_vaccinated.getDisplayValue();

          if (allowedvaccineStatus.indexOf(responseVaccneStatus) != -1) {
            returnObj.isAllowed = true;
            returnObj.reason = "in_progress"; //Vaccination status are present
          } else {
            returnObj.reason = "non_vaccinated"; //Vaccination status are not present
          }
        } else {
          returnObj.isAllowed = true;
          returnObj.reason = "in_progress"; // All Employess
        }
      } else {
        if (submission == "all_employees") {
          returnObj.isAllowed = true;
          returnObj.reason = "in_progress";
        } else {
          returnObj.reason = "non_vaccinated"; // Record not found
        }
      }

      return returnObj;
    },

    //vaccine Exemption Required True
    getVaccineExemption: function (user) {
      var returnObj = {
        isAllowed: false,
        reason: "",
      };

      var vaccineProfileGr = new GlideRecord("sn_imt_vaccine_vaccine_profile");
      vaccineProfileGr.addQuery("user", user);
      vaccineProfileGr.query();
      if (vaccineProfileGr.next()) {
        var currentDate = new GlideDateTime();
        var vaccineExemptionExpiredDate =
          vaccineProfileGr.exemption_expiration_date;
        var vaccineExeptionGlideDate = new GlideDateTime(
          vaccineExemptionExpiredDate
        );

        if (vaccineExeptionGlideDate.compareTo(currentDate) > 0) {
          returnObj.isAllowed = true;
          returnObj.reason = "in_progress"; //vaccine exemption not expired
        } else {
          returnObj.reason = "not_valid_vaccine_exemption"; // vaccine exemption  expired
        }
      } else {
        returnObj.reason = "non_vaccinated"; // Record not found
      }
      return returnObj;
    },

    getUserRoleAndVip: function (user) {
      var userId;
      if (user) {
        userId = user;
      } else {
        userId = gs.getUserID();
      }
      var group_sys_id = gs.getProperty(
        "sn_imt_health_test.covid19.vaccination.review.group.sys_id"
      );
      var userGr = new GlideRecord("sys_user");
      userGr.get(userId);
      var showGroupMemebrs = false;
      if (gs.getUser().isMemberOf(group_sys_id)) {
        showGroupMemebrs = true;
      }
      return showGroupMemebrs;
    },
    /**
     * @author RC
     * @returns {String} sys_id
     */
    _getUserWorkLocation: function () {
      var userGr = new GlideRecord("sys_user");
      userGr.get(gs.getUserID());
      return userGr.location + "";
    },
    /**
     * @author RC
     * @function _checkUserBelongsToAudience returns whether logged in user belongs to audience
     * @param testLocationPrivacyGr @typedef {GlideRecord}
     * @returns {Boolean}
     */
    _checkUserBelongsToAudience: function (testLocationPrivacyGr) {
      //
      var audiences = testLocationPrivacyGr.getValue("u_audience");
      var swaUtil = new sn_imt_core.SafeWorkplaceAudienceUtil();
      var response = swaUtil.requirementAppliesToLocationAndUser_TestingApp(
        audiences,
        this._getUserWorkLocation(),
        gs.getUserID()
      );
      gs.warn("RC debug _checkUserBelongsToAudience " + typeof response);
      return response;
    },
    // @note RC - changed logic
    getVaccineStatusReason: function (user) {
      var statusArr = [];
      var userId;
      if (user) {
        userId = user;
      } else {
        userId = gs.getUserID();
      }

      var vaccineStatus = {};
      var testingLocationGr = new GlideRecord(
        VAMConstants.TABLE.TESTING_LOCATION_PRIVACY_CONFIGURATION
      );
      // @note RC - disabled below - query all
      // testingLocationGr.addEncodedQuery(
      //   "u_country_code=" + this.getUserCountry(userId)
      // );
      testingLocationGr.addQuery("u_active", true); // RC added new
      testingLocationGr.query();
      var isAudience = false;
      while (testingLocationGr.next()) {
        var errorMsg = testingLocationGr.u_testing_app_error_message + "";
        // @note RC - added
        isAudience = this._checkUserBelongsToAudience(testingLocationGr);
        // RC - if audience found only then continue
        if (isAudience) {
          // RC if audience then check if testing enabled
          if (testingLocationGr.u_testing_enabled == true) {
            if (testingLocationGr.u_vaccination_exemption == false) {
              var allowedVaccineStatus = testingLocationGr.u_testing_allowed_vaccine_status.getDisplayValue();
              var allowSubmission = testingLocationGr.u_allow_submission_for;
              vaccineStatus = this.getVaccineResponseVaccineStatus(
                allowedVaccineStatus,
                allowSubmission,
                userId
              );
            } else {
              vaccineStatus = this.getVaccineExemption(userId);
            }
          } else {
            vaccineStatus = {
              isAllowed: false,
              reason: "not_enabled",
            };
          }
          // RC get out of loop - found any match
          break;
        }
      }
      // RC after loop is over - still no audience
      if (!isAudience) {
        vaccineStatus = {
          isAllowed: false,
          reason: "not_enabled",
        };
      }
      statusArr = [vaccineStatus, errorMsg];

      return statusArr;
    },

    getTestingLocationConfiguration: function () {
      var errorMsg = "";
      var vaccineStatus;
      if (!this.getUserRoleAndVip()) {
        // if the user Not in COVID19 GT vaccination Review Group
        var statusArr = this.getVaccineStatusReason();
        vaccineStatus = statusArr[0];
        errorMsg = statusArr[1];
      } else {
        // if the user COVID19 GT vaccination Review Group
        vaccineStatus = {
          isAllowed: true,
          reason: "in_progress", // Group Member
        };
      }

      var result = this.newItem("result");
      result.setAttribute("vaccine_status", JSON.stringify(vaccineStatus));
      result.setAttribute("is_mobile", gs.isMobile());
      result.setAttribute("error_message", errorMsg);
    },

    getonBehalfofConfiguration: function () {
      var vaccineStatus = "";
      var errorMsg = "";
      var userId = this.getParameter("user");
      if (this.getUserRoleAndVip(userId)) {
        var statusArr = this.getVaccineStatusReason(userId);
        vaccineStatus = statusArr[0];
        errorMsg = statusArr[1];
      }

      var result = this.newItem("result");
      result.setAttribute("vaccine_status", JSON.stringify(vaccineStatus));
      result.setAttribute("is_mobile", gs.isMobile());
      result.setAttribute("error_message", errorMsg);
    },

    getUserCountry: function (user) {
      var userGr = new GlideRecord("u_employee");
      userGr.addQuery("sys_id", user);
      userGr.query();
      if (userGr.next()) {
        var country = userGr.country;
        return country;
      }
    },

    //Return users from only those location where testing enabled is true in test location configuration table
    //DFCT0146746 Added new hire users to the list
    getUsersFromLocation: function () {
      var countries = [];
      var locationGr = new GlideRecord(
        VAMConstants.TABLE.LOCATION_PRIVACY_CONFIGURATION
      );
      locationGr.addEncodedQuery("u_collect_vaccination_status=true");
      locationGr.query();
      while (locationGr.next()) {
        var location = locationGr.location;
        var vaccineCodeGr = new GlideRecord("core_country");
        vaccineCodeGr.addQuery("name", location);
        vaccineCodeGr.query();
        if (vaccineCodeGr.next()) {
          countries.push(vaccineCodeGr.iso3166_2);
        }
      }
      return (
        "countryIN" +
        countries.join(",") +
        "^active=true^emailENDSWITH@servicenow.com^ORcompany=" +
        gs.getProperty("sn_imt_vaccine.sysid.of.servicenow_newhire.company")
      );
    },

    type: "VaccinationStatusUtilAJAXProcessor",
  }
);
