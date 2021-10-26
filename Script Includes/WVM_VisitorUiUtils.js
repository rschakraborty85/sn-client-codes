var WVM_VisitorUiUtils = Class.create();
WVM_VisitorUiUtils.prototype = Object.extendsObject(
  global.AbstractAjaxProcessor,
  {
    TABLES: {
      VISIT: WSDVMConstants.TABLES.sn_wsd_visitor_visit.name,
      VISIT_LOG: WSDVMConstants.TABLES.sn_wsd_visitor_visit_log.name,
      VISITOR: WSDVMConstants.TABLES.sn_wsd_visitor_visitor.name,
      REGISTRATION:
        WSDVMConstants.TABLES.sn_wsd_visitor_visitor_registration.name,
      PRINTER_CONFIG: "sn_wsd_visitor_printer_configuration",
      LOCATION: "cmn_location",
      PRINT_LOG: "sn_wsd_visitor_m2m_printer_visitor_log",
      USER: "u_employee",
      SPACE: "sn_wsd_core_space",
      EHS_VISITOR_INVITATION: "sn_imt_core_visitor_invitation",
      EHS_VISITOR_CORE: "sn_imt_core_visitor",
    },
    // @note RC - added part of STRY2462909
    // returns object
    getPrinterConfigGrObj: function (printer_config_sys_id) {
      var printerConfigGR = new GlideRecord(this.TABLES.PRINTER_CONFIG);
      printerConfigGR.get(printer_config_sys_id);
      return this._setGrToObj(printerConfigGR);
    },
    getLoggedInUserBuilding: function () {
      //
      return this._getUserBuilding();
    },
    createPrinterVisitorLog: function (
      visitor_registration_sys_id,
      badge_data_url
    ) {
      //gs.info("RC createPrinterVisitorLog badge " + badge_data_url);
      var registrationGR = new GlideRecord(this.TABLES.REGISTRATION);
      if (registrationGR.get(visitor_registration_sys_id)) {
        var printLogGR = new GlideRecord(this.TABLES.PRINT_LOG);
        printLogGR.newRecord();
        printLogGR.u_visitor_registration = visitor_registration_sys_id;
        printLogGR.u_printer_configuration = this._getPrinterConfigIDFromBuildingID(
          registrationGR.location.toString()
        );
        printLogGR.u_status = "queued";
        printLogGR.insert();
        //change status to checked in if its in planned state

        if (registrationGR.state == "planned") {
          registrationGR.state = "checked_in";
          registrationGR.update();
        }
        // get rid of prefix
        var base64encodedData = badge_data_url.replace(
          /^data:image\/(png|jpg);base64,/,
          ""
        );
        var atchment = new GlideSysAttachment();
        var atchmentSysID = atchment.writeBase64(
          printLogGR,
          registrationGR.number.toString() + "_badge",
          "image/png",
          base64encodedData
        );
        return atchmentSysID;
      }
    },
    getHostFromVisit: function (visit_sys_id) {
      var visitGR = new GlideRecord(this.TABLES.VISIT);
      visitGR.get(visit_sys_id);
      return visitGR.host.getDisplayValue();
    },
    //
    getRegistrationGrObj: function (registration_id) {
      //gs.info("RAVI>>>registration_id=" + registration_id);
      this.responseObject = {};
      this.responseObject.array = [];
      var registrationGR = new GlideRecord(this.TABLES.REGISTRATION);
      if (registrationGR.get(registration_id))
        return this._setGrToObj(registrationGR);
      return "";
    },
    // get EHS sys id from WSD sys id
    // receive wsd registration id and return ehs core visitor sys id
    getEhsVisitorObjFromWsdID: function (visitor_registration_sys_id) {
      var regisGR = new GlideRecord(this.TABLES.REGISTRATION);
      if (regisGR.get(visitor_registration_sys_id)) {
        var invitationGR = new GlideRecord(this.TABLES.EHS_VISITOR_INVITATION);
        if (invitationGR.get("u_wsd_visitor", regisGR.sys_id.toString())) {
          //return invitationGR.visitor.toString();
          return this._setGrToObj(invitationGR);
        }
      }
    },
    // get phase of building , base on which
    // the safety features will trigger or not
    getBuildingPhase: function (printer_config_id) {
      var printerConfigGR = new GlideRecord(this.TABLES.PRINTER_CONFIG);
      printerConfigGR.get(printer_config_id);
      return printerConfigGR.u_building.u_phase.toString();
    },
    // get either last used printer
    // or based on one's location of user profile
    getDefaultPrinterForLoggedInUser: function () {
      var lastPrintGR = new GlideRecord(this.TABLES.PRINT_LOG);
      if (lastPrintGR.get("sys_created_by", gs.getUserName())) {
        return {
          value: lastPrintGR.u_printer_configuration.toString(),
          display_value: lastPrintGR.u_printer_configuration.u_display_name.toString(),
        };
      } else {
        var printerConfigGR = new GlideRecord(this.TABLES.PRINTER_CONFIG);
        if (printerConfigGR.get("u_building", this._getUserBuilding())) {
          return {
            value: printerConfigGR.sys_id.toString(),
            display_value: printerConfigGR.u_display_name.toString(),
          };
        }
      }
      return "";
    },
    // get visitors available for current day
    // and based on selected printer / building on rtw page
    getVisitorQueryBasedOnPrinter: function (printer_config_id) {
      this.responseObject = {};
      this.responseObject.array = [];
      var locationID = this._getBuildingLocation(printer_config_id);
      var staticQuery =
        "active=true^expected_arrivalONToday" +
        "@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()";
      var locationQuery = "^location=" + locationID;

      return staticQuery + locationQuery;
    },

    // All private functions down below
    _getPrinterConfigIDFromBuildingID: function (location_sys_id) {
      var printerConfigGR = new GlideRecord(this.TABLES.PRINTER_CONFIG);
      printerConfigGR.get("u_building", location_sys_id);
      return printerConfigGR.sys_id.toString();
    },
    _setResponseObject: function (glide_record_object) {
      return this.responseObject.array.push(
        this._setGrToObj(glide_record_object)
      );
    },
    _setGrToObj: function (gr) {
      var obj = {};
      for (var o in gr) {
        obj[o] = {
          display_value: gr.getDisplayValue(o),
          value: gr.getValue(o),
        };
      }
      return obj;
    },
    _getUserBuilding: function () {
      return this._getUserSpace(this._getUserObject())
        ? this._getUserSpace(this._getUserObject()).building.toString()
        : "";
    },
    _getUserSpace: function (userGR) {
      var wsdSpaceGR = new GlideRecord(this.TABLES.SPACE);
      if (
        wsdSpaceGR.get(
          "u_nuvolo_space",
          userGR.u_workspace.document_id.toString()
        )
      )
        return wsdSpaceGR;
      return "";
    },
    _getUserObject: function () {
      var userGR = new GlideRecord(this.TABLES.USER);
      userGR.get(gs.getUserID());
      return userGR;
    },

    _getBuildingLocation: function (printer_config_id) {
      if (!gs.nil(printer_config_id)) {
        var printerConfigGR = new GlideRecord(this.TABLES.PRINTER_CONFIG);
        printerConfigGR.get(printer_config_id);
        return printerConfigGR.getValue("u_building");
      } else {
        return this._getUserBuilding();
      }
    },
    _getUserLocation: function () {
      var userGR = new GlideRecord(this.TABLES.USER);
      userGR.get(gs.getUserID());
      return userGR.location.toString();
    },
    type: "WVM_VisitorUiUtils",
  }
);
