function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  try {
    // Check if this is a bulk submission from the 'Send All' button
    if (e.parameter.bulk_data) {
      // Parse the JSON array of leads
      var leads = JSON.parse(e.parameter.bulk_data);
      
      // Prepare a 2D array of rows to use the fast batched append
      var rowsToAppend = leads.map(function(lead) {
        return [
          lead.firmName || "",
          lead.lawyerName || "",
          lead.title || "",
          lead.tel || "",
          lead.email || "",
          lead.practiceArea || "",
          lead.country || "",
          lead.city || "",
          lead.url || "",
          new Date()
        ];
      });
      
      // Bulk append all rows at once - virtually frictionless!
      if (rowsToAppend.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
      }
      
      return ContentService.createTextOutput("Bulk Success").setMimeType(ContentService.MimeType.TEXT);
    }
    
    // Fallback: Individual Lead Submissions
    var rowData = [
      e.parameter.firmName || "",
      e.parameter.lawyerName || "",
      e.parameter.title || "",
      e.parameter.tel || "", // The extension adds the prefix "'" so + does not resolve as formula
      e.parameter.email || "",
      e.parameter.practiceArea || "",
      e.parameter.country || "",
      e.parameter.city || "",
      e.parameter.url || "",
      new Date()
    ];
    
    sheet.appendRow(rowData);
    return ContentService.createTextOutput("Individual Success").setMimeType(ContentService.MimeType.TEXT);
    
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.message).setMimeType(ContentService.MimeType.TEXT);
  }
}
