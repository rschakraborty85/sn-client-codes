(function () {
  // RC , make brightcove account deails managable - start
  data.brighcove_data_account = "5703385908001"; //5148394746001
  data.brighcove_data_player = "Qz2ECTdlP"; // "default";//QJ4mcjGqj
  data.brighcove_src_url =
    "https://players.brightcove.net/" +
    data.brighcove_data_account +
    "/" +
    data.brighcove_data_player +
    "_default/index.min.js";
  //     console.log("RC > "+data.brighcove_src_url);
  // end
  // gs.info("Show large video " + options.show_larger_video);
  data.show_larger_video = options.show_larger_video;
  var record_SYS_ID = options.rec_sys_id;
  var grOfficeSafety = new GlideRecord("sn_imt_quarantine_covid_19_resources");
  if (grOfficeSafety.get(record_SYS_ID)) {
    // console.log(
    //   "RC record_SYS_ID=" + record_SYS_ID + "\tzero_top=" + options.zero_top
    // );
    var obj = {};
    // @note RC
    obj.zero_top = options.zero_top ? true : false;
    obj.title = grOfficeSafety.getDisplayValue("u_title");
    obj.description = grOfficeSafety.u_description.getHTMLValue();
    obj.image = grOfficeSafety.getDisplayValue("u_image");
    // RC - added video rendering capability - start
    obj.video_id = grOfficeSafety.getDisplayValue("u_video_id");
    obj.video_text = grOfficeSafety.getDisplayValue("u_video_text");
    // RC - added video rendering capability - end
    obj.alignmentType = grOfficeSafety.getValue("u_type");
    if (grOfficeSafety.u_footer_link) {
      obj.footerLink = grOfficeSafety.getDisplayValue("u_footer_link");
      obj.footerText = grOfficeSafety.getDisplayValue("u_footer_text");
    }
    // 	  console.log("RC obj.footerText "+obj.footerText);
    obj.alignmentType = grOfficeSafety.getValue("u_type");
    data.rtoResource = obj;
  }
  //   RC - STRY2435835
  if (input && input.action == "capture_journey") {
    var current = new GlideRecord(input.table);
    current.get(input.sys_id);
    var graphUtil = new global.journeyGraphUtil();
    graphUtil.processDefinitionBySysId(input.defSysId, current, input.notes);
  }
})();
