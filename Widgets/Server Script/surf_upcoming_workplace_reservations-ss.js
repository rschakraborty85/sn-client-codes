(function () {
	// checck if mobile
	data.mobile = gs.isMobile();
	data.mappedin_enabled = gs.getProperty('mappedin.enabled');

	var view = $sp.getParameter("view");
	var localInput = input; //to safeguard pollution of 'input' via BR or other scripts
	data.user_selected = false;
	data.myView = (view == 'self')?true:false;

	// get shift details
	var shiftReserv = new sn_imt_core.ShiftReservationUtil();
	data.myShiftReservList = shiftReserv.getMyShiftDetails(gs.getUserID());
	data.hasShift = data.myShiftReservList.length > 0 ? true : false;

	// get reservation details
	var utilReserv = new sn_imt_core.selfReservationUtil();
	data.myReservationList = utilReserv.getMySelfReservationDetail();
	data.hasReserve = data.myReservationList.length > 0 ? true : false;

	if (data.hasShift && data.hasReserve) {
		data.hasBoth = true;
		data.headerLabel = "Shift/Workspace";
	} else if (data.hasShift) data.headerLabel = "Shift";
	else if (data.hasReserve) data.headerLabel = "Workspace";

	// for cancelling reservation ̰
	if (input && input.action == "myreservation") {
		if (IsEnabledSelfReserve()) {
			if (input && input.cancelRequest) {
				var wprId = input.cancelRequest;
				var wpr_gr = new sn_wsd_core.selfReserveUtil_WSM();
				wpr_gr.cancelWPRRequest(wprId);
				wpr_gr.checkAndCancelSelfReservation(wprId);
			}
			data.myReservationList = utilReserv.getMySelfReservationDetail();
		}
	}

	function IsEnabledSelfReserve() {
		var bReturnFlag = false;

		if (gs.hasRole("sn_wsd_core.workplace_user")) bReturnFlag = true;
		return bReturnFlag;
	}

	if(data.mobile){
		data.isMobileShift = false;
		var rto_shift = gs.getProperty(sn_wsd_core.WSMConstants.RTO_SHIFT_USERS_GROUP_SYS_ID_PROPERTY);
		if(gs.getUser().isMemberOf(rto_shift)){
			data.isMobileShift = true;
		}
		
		data.isMobileReservation = false;
		var rto_reservation = gs.getProperty('sn_imt_checkin.rto.self.reserve.users.group.sys_id');
		if(gs.getUser().isMemberOf(rto_reservation)){
			data.isMobileReservation = true;
		}
	}
	//mobile
	if (input && input.action == 'goToMyReservation'){
		var goToMyReservationAppletID = global.NowMobileConfig.RTO_MY_RESERVATIONS;
		var link = '';

		var deepLinkGenerator = new global.MobileDeepLinkGenerator("request");
		link = deepLinkGenerator.getScreenLink(goToMyReservationAppletID, '');

		data.mobile_link = link;
		return;
	}

	if (input && input.action == 'goToMyShifts'){
		var goToMyShiftsAppletID = global.NowMobileConfig.RTO_MY_SHIFTS;
		var link1 = '';

		var deepLinkGenerator1 = new global.MobileDeepLinkGenerator("request");
		link1 = deepLinkGenerator1.getScreenLink(goToMyShiftsAppletID, '');

		data.mobile_link = link1;
		return;
	}


	/*
      function getMyReservationSysIds() {
          var ids = [];
          var filter = 'active=true^is_parent=true^start>=' + new GlideDateTime();
          var tableName = 'sn_wsd_core_reservation';
          if (!localInput && view == 'self') {
              filter = filter + '^requested_for=' + gs.getUserID();
              data.user = gs.getUserID();
              data.user_type = 'employee';
              data.user_selected = true;
              data.lastLimit = 0;
          }
          if (localInput && localInput.user && localInput.user_type == 'employee') {
              filter = filter + '^requested_for=' + localInput.user;
              data.user = localInput.user;
              data.user_type = 'employee';
              data.user_selected = true;
              data.lastLimit = 0;
          }
          if (localInput && (localInput.user == '' || localInput.user_type == 'visitor')) {
              data.user = '';
              data.user_type = '';
              data.user_selected = false;
          }
      }

          if (data.user_selected) {
              var grReservation = new GlideRecord(tableName);
              grReservation.addEncodedQuery(filter);
              grReservation.query();

              while (grReservation.next()) {
                  ids.push(grReservation.getUniqueValue());
              }
          }
          return ids;
      }

      // retrieve the reservations

      var reservationIDs = getMyReservationSysIds();
      var grReservation = new GlideRecord('sn_wsd_core_reservation');
      grReservation.addActiveQuery();
      grReservation.orderBy('start');
      grReservation.addQuery('sys_id', reservationIDs);
      grReservation.query();
      data.reservation = {};

      data.reservation.reservation_list = [];
      var recordIdx = 0;
      var limit = options.items_per_page ? options.items_per_page : 10;
      if (localInput && localInput.action == 'fetch_more')
          data.lastLimit = localInput.lastLimit + limit;
      else
          data.lastLimit = limit;

      data.hasMore = false;
      while (recordIdx != data.lastLimit && grReservation.next()) {
          var record = {};

          record.sys_id = grReservation.getValue('sys_id');
          record.display_field = grReservation.getValue('number');
          record.secondary_display = grReservation.getDisplayValue('requested_for');
          record.shift = grReservation.getDisplayValue('shift');
          record.location = grReservation.getDisplayValue('location');
          record.start = grReservation.getValue('start');
          record.end = grReservation.getValue('end');

          if ((recordIdx !== 0) && (data.lastLimit - limit === recordIdx))
              record.highlight = true;

          data.reservation.reservation_list.push(record);
          recordIdx++;
      }
      */

	//return;

	//if (grReservation.next())
	// data.hasMore = true;
})();
