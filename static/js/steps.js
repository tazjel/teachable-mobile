
var STEPS = {};

STEPS.init = function(){
    // Setting dialog
    APP.updateStepDialog = $("#update-step-dialog");
    setDialog(APP.updateStepDialog);
    APP.updateStepDialog.bind('dialogclose', function(){olddata=undefined;});

    // Setting action listeners
    $("#execute-steps-button").click(executeStep);

    // Setting listeners for selec current step form
    //$("#update-step-form").change(updateHiddenField); // Might not be needed
    $("#select-current-step-button").click(selectCurrentStep);
    $("#update-step-form select").change(updateStepParamsList);

    // Update current procedure's steps list (duh)
    updateCurrentProcedureStepsList();
}

/*
 * This function uses the 'updateCurrentStepDialog_CB' as its callback.
 * TODO Maybe we could simply store the list of procedures on the client
 *      and avoid this trip to the server? Right now this idea works, but what if
 *      we start using user-created procedures? A: we simply add the newly created
 *      function to the list. Duh.
 *      UPDATE: APP.basicProcedures is a list of basic (non user-created) procedures.
 */
function updateCurrentStep(){
    ajax(APP.UPDATE_STEP + "?trigger=" + olddata.trigger + "&callback=updateCurrentStepDialog_CB", [], ":eval")
}

/*
 * CALLBACK
 * This function is called as the callback for the 'updateCurrentStep' function.
 * 'object' is a list of procedures that comes from the server.
 */
function updateCurrentStepDialog_CB(object){
    // resetting dialog
    resetStepDialog();
    //$("#update-step-form select").blur();
    // Obtaining procedures select element
    var select = $("#update-step-form select");
    // Clearing it's content
    select.empty();
    // Adding new procedures
    $.each(object, function(index, value){
        select.append($("<option value='" + JSON.stringify(value) + "'>" + value.displayLabel + "</option>"));
    });
    // Updating step param list
    updateStepParamsList();
    // Opening dialog
    APP.updateStepDialog.dialog("open");
}

function resetStepDialog(){
    $("#update-step-form select").empty();
    $("#current-step-select-params").empty();
}

function updateStepParamsList(){
    // Retrieving object from olddata
    var appletObject = olddata;
    // Clearing current params
    $("#current-step-select-params").empty();
    var list = $("#update-step-form select");
    // "blurring" select to remove iPod's dropdown widget
    list.blur();
    // Creating array of parameters based on selected trigger parameters field
    var selected = list.find(":selected").val();
    var selectedStep = JSON.parse(selected);
    // Create fields based on parameters array
    if(selectedStep.parameters.length === 0){
        $("#current-step-select-params").text("No parameters");
    } else {
        for(var i = 0; i < selectedStep.parameters.length; i++){
            var param = selectedStep.parameters[i];
            $("#current-step-select-params").append($("<label>", {
                text : param
            }));
            $("#current-step-select-params").append($("<input>", {
                type : "text",
                id : param,
                value : appletObject[param]
            }));
        }
    }
    list.focus();
}

function selectCurrentStep(event){
    var form = $("#update-step-form");
    var labels = $("#current-step-select-params label");
    var procName = JSON.parse($("select option:selected", form).val()).name; // Getting procedure's name
    var parameters = {};
    var parametersArray = []
    $.each(labels, function(index, value){
        var paramName = value.innerText
        var paramValue = $("input#" + paramName, form).val();
        parameters[paramName] = paramValue;
        parametersArray.push(paramValue);
    });
    // Validating input
    if(validateInput(form, labels, procName, parameters)){
        // Clearing olddata
        olddata = undefined;
        // Closing dialog
        APP.updateStepDialog.dialog("close");
        // creating label
        var label = APP.basicProcedures[procName].label;
        label = String.prototype.format.apply(label, parametersArray);
        // Updating hidden field
        returnObject = {name: procName, label: label, op: parameters};
        $("#procedure_parameters").val(JSON.stringify(returnObject));
        // Make ajax call to update the server's polling field
        ajax(APP.EXECUTE_EVENT, ['procedure_parameters'], ":eval");
        // Set current procedure label to the selected procedure
        var currentStep = $("#current-step");
        currentStep.html("<span></span>" + label);
        setDraggable(currentStep);
        $("span", currentStep).bind("touchstart", function(e) { e.preventDefault(); });
        // Setting current step object
        APP.currentStep = returnObject;

        /* "Hack" to automatically add this step to the list */
        /* I think that, ideally, this should be done in another way */
        insertNewStep($("#steps-list .droppable:last"), $("#current-step").html());

        // Logging selected action
        log("Select Current Step", JSON.stringify(APP.currentStep, null, 4));
    }
    // Check if user entered drag mode
    switch(APP.currentStep.name){
        case "movePoint":
            $("#steps-list-title > span").css('visibility', 'visible');
            break;
        case "stopMovingPoint":
            $("#steps-list-title > span").css('visibility', 'hidden');
            break;
    }

}

function validateInput(form, labels, procName, parameters){
    /*
     * Validation is performed based on the procedure's name.
     * Ideally, it would be done based on each parameter's 
     * data types. Currently, parameters do not have data type.
     */
    if(procName === 'moveDistance'){
        // Checks if the parameters is a number or if it's within range
        if(!isNumber(parameters['distance']) || parameters['distance'] > 5 || parameters['distance'] < -5){
            toggleError(labels, "color", "red", "black");
            return false;
        }
    } else if(procName === 'turnAngle'){
        if(parameters['angle'] > 360){
            toggleError(labels, "color", "red", "black");
            return false;
        }
    } else if(procName === 'moveTo'){
        // Checks if the point parameter has a valid point name in it
        if(!isPoint(parameters['pointName'])){
            toggleError(labels, "color", "red", "black");
            return false;
        }
    } else if(procName === 'turnTo'){
        // Checks if the point parameter has a valid point name in it
        if(!isPoint(parameters['pointName'])){
            toggleError(labels, "color", "red", "black");
            return false;
        }
    } else if(procName === 'drawLineTo'){
        var isValid = true;
        if(!isPoint(parameters['pointName'])){
            toggleError($(labels[0]), "color", "red", "black");
            isValid = false;
        }
        if(!isPoint(parameters['pointName2'])){
            toggleError($(labels[1]), "color", "red", "black");
            isValid = false;   
        }
        return isValid;
    } else if(procName === 'turnCardinal'){
        if(parameters['direction'] !== 'N' &&
           parameters['direction'] !== 'S' &&
           parameters['direction'] !== 'E' &&
           parameters['direction'] !== 'W'){
            toggleError(labels, "color", "red", "black");
            return false;
        }
    }
    return true;
}

/*
 * This function tells the applet to clear itself and run all the steps in the list
 */
function executeStep(event){
    log("Executing ALL steps");
    if(event !== undefined){
        event.preventDefault();
    }
    COMM.sendToApplet(JSON.stringify(APP.currentStepsList));
}