var WSDReservableModuleService = Class.create();
WSDReservableModuleService.prototype = Object.extendsObject(
  WSDReservableModuleServiceSNC,
  {
    /**
     * RC - overridding
     * Gets the display value and sysid of the module provided
     * @param {string} moduleSysId
     * @returns {object|null}
     */
    getReservableModuleAsChoiceById: function (moduleSysId) {
      if (!moduleSysId) return null;

      var moduleGr = new GlideRecord(WSDConstants.TABLES.ReservableModule.name);
      if (!moduleGr.get(moduleSysId)) return null;

      if (!this.isValidReservableModuleGr(moduleGr)) return null;
      //gs.info("RC module max day value " + moduleGr.getValue("max_days_in_future"));
      // @note RC - STRY2469789
      if (
        // moduleSysId ==
        // gs.getProperty("sn_wsd_rsv.neighborhood.workspace.sys_id")
        gs
          .getProperty("sn_wsd_rsv.neighborhood.workspace.sys_id")
          .split(",")
          .indexOf(moduleGr.sys_id + "") > -1
      )
        var extraWord = " neighborhood ";
      else extraWord = " ";

      return {
        sys_id: moduleSysId,
        display_value: moduleGr.getDisplayValue(),
        name: moduleGr.getValue("name"), // on frontend we use name as display
        apply_to_shift: WSDUtils.safeBool(moduleGr.getValue("apply_to_shift")),
        allow_multi_select: moduleGr.u_allow_multi_select.getDisplayValue(), // RC
        filter_has_select_seat: this._checkFilterHasSelectSeat(moduleGr), // RC
        max_days_in_future: moduleGr.getValue("max_days_in_future"), // RC
        reserve_module_msg: gs.getMessage("reserve_mod_max_days", [
          moduleGr.getValue("max_days_in_future"),
          extraWord,
        ]),
      };
    },
    // RC - added new functions
    _checkFilterHasSelectSeat: function (moduleGr) {
      if (moduleGr.reservable_filter) {
        if (
          moduleGr.reservable_filter.indexOf("area.u_select_seat=true") > -1
        ) {
          return "true";
        } else if (
          moduleGr.reservable_filter.indexOf("area.u_select_seat=false") > -1
        ) {
          return "false";
        } else return "";
      }
      return "";
    },
    getBuildingQueryBasedOnReservMod: function (reservableModuleSysID) {
      try {
        if (WSDUtils.nullOrEmpty(reservableModuleSysID)) return null;
        var reservableModuleGr = new GlideRecord(
          WSDConstants.TABLES.ReservableModule.name
        );
        reservableModuleGr.get(reservableModuleSysID);
        var filter = reservableModuleGr.reservable_filter;
        // have to have a condition
        if (filter) {
          var spaceGR = new GlideAggregate(WSDConstants.TABLES.Space.name);
          spaceGR.addEncodedQuery(filter);
          spaceGR.addAggregate("COUNT", "building");
          spaceGR.groupBy("building");
          spaceGR.query();
          var buildingArr = [];
          //var buildingCount = spaceGR.getRowCount();
          while (spaceGR.next()) {
            // get all the building sysid for a
            // reservable module
            buildingArr.push(spaceGR.building.toString());
          }
          return buildingArr.toString();
        } else {
          throw "No Filter Defined";
        }
      } catch (error) {
        gs.error("ERROR > " + error);
      }
    },

    /**
     * get reservable module based on sys_id
     * @param {string} moduleSysId - sys_id of the module
     * @return {ReservableModule|null} reservable module object
     */
    getReservableModule: function (moduleSysId) {
      if (WSDUtils.nullOrEmpty(moduleSysId)) return null;

      var reservableModuleGr = new GlideRecord(
        WSDConstants.TABLES.ReservableModule.name
      );
      if (!reservableModuleGr.get(moduleSysId)) {
        WSDLogger.error(
          "WSDReservableModuleServiceSNC.getReservableModule",
          "Invalid module sys_id",
          moduleSysId
        );
        return null;
      }

      if (!this.isValidReservableModuleGr(reservableModuleGr)) return null;

      return this._constructModuleFromGr(reservableModuleGr);
    },
    /**
     * construct an object from a single GlideRecord record
     * @param {GlideRecord} reservableModuleGr
     * @return {ReservableModule}
     */
    _constructModuleFromGr: function (reservableModuleGr) {
      var mappedinIsActive = GlidePluginManager.isActive("com.sn_wsd_mappedin");
      var reservableModuleColumns =
        WSDConstants.TABLES.ReservableModule.columns;
      if (mappedinIsActive) reservableModuleColumns.push("show_map_view");
      var reservableModule = this.recordUtils.getObjectFromGlideRecord(
        reservableModuleGr,
        reservableModuleColumns
      );
      //gs.info("RC in WSDReservableModuleService _constructModuleFromGr - module " + JSON.stringify(reservableModule));
      reservableModule.require_cancel_notes = WSDUtils.safeBool(
        reservableModule.require_cancel_notes
      );
      if (mappedinIsActive)
        reservableModule.show_map_view = WSDUtils.safeBool(
          reservableModule.show_map_view
        );

      var selectionType = reservableModuleGr.getValue("selection_type");

      if (
        reservableModule.reservable_type ===
        WSDConstants.RESERVABLE_TYPE.location
      ) {
        // workplace location
        reservableModule.reservable_columns =
          WSDConstants.TABLES.WorkplaceLocation.columns;
        reservableModule.layout_mapping = this._constructLayoutMappingForLocation(
          selectionType
        );
        // RC - changed
        var sysids = this.getBuildingQueryBasedOnReservMod(
          reservableModuleGr.sys_id
        );
        reservableModule.building_filter_from_reservable_module = sysids;
        // RC - end
      } else {
        // configuration item
        reservableModule.reservable_columns =
          WSDConstants.TABLES.ConfigurationItem.columns;
        reservableModule.layout_mapping = this._constructLayoutMappingForCI(
          selectionType
        );
      }
      // @note RC - STRY2469789
      if (
        // reservableModuleGr.sys_id ==
        // gs.getProperty("sn_wsd_rsv.neighborhood.workspace.sys_id")
        gs
          .getProperty("sn_wsd_rsv.neighborhood.workspace.sys_id")
          .split(",")
          .indexOf(reservableModuleGr.sys_id + "") > -1
      )
        var extraWord = " neighborhood ";
      else extraWord = " ";

      reservableModule.reserve_module_msg = gs.getMessage(
        "reserve_mod_max_days",
        [reservableModuleGr.getValue("max_days_in_future"), extraWord]
      );
      return reservableModule;
    },

    type: "WSDReservableModuleService",
  }
);
