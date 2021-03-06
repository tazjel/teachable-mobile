
var STEPS = {};

/*
 * The variable *dragRestriction* defines a blacklist of actions for dragmode
 */
var dragRestrictions = {
    movePoint : true,
    movePointDistance : true,
    plotPoint : true
}

/*
 * The variable *nonDragRestriction* defines a blacklist of actions for normal mode (not dragging)
 */
var nonDragRestrictions = {
    stopMovingPoint : true
}

STEPS.init = function() {
    // Setting dialog
    APP.updateStepDialog = $("#update-step-dialog");
    // alert(APP.updateStepDialog);
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

STEPS.startDragMode = function() {
    $("body").addClass('dragMode');
}

STEPS.stopDragMode = function() {
    $("body").removeClass('dragMode');
}

STEPS.isInDragMode = function() {
    return $("body").hasClass("dragMode");
}

/*
 * This function uses the 'updateCurrentStepDialog_CB' as its callback.
 * TODO Maybe we could simply store the list of procedures on the client
 *      and avoid this trip to the server? Right now this idea works, but what if
 *      we start using user-created procedures? A: we simply add the newly created
 *      function to the list. Duh.
 *      UPDATE: APP.basicProcedures is a list of basic (non user-created) procedures.
 */
function updateCurrentStep() {
    // log("Step selection window opened",{"source":__SOURCE__});
    // ajax(APP.UPDATE_STEP + "?trigger=" + olddata.trigger + "&callback=updateCurrentStepDialog_CB", [], ":eval");
    updateCurrentStepDialog_CB(APP.basicProceduresArray);
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
        var option = $("<option value='" + JSON.stringify(value) + "'>" + value.displayLabel + "</option>");
        if(STEPS.isInDragMode() && dragRestrictions[value.name]){ // If it's in drag mode, apply restriction
            option.attr("disabled", "disabled");
        } else if(!STEPS.isInDragMode() && nonDragRestrictions[value.name]) { // apply non drag mode restrictions
            option.attr("disabled", "disabled");
        }
        select.append(option);
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
        $("#current-step-select-params").text("");
    } else {
        for(var i = 0; i < selectedStep.parameters.length; i++){
            var param = selectedStep.parameters[i];
            $("#current-step-select-params").append($("<label>", {
                text : getPlainParameterName(param)
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

function selectCurrentStep(event) {
    var form = $("#update-step-form");
    var labels = $("#current-step-select-params label");
    var procName = JSON.parse($("select option:selected", form).val()).name; // Getting procedure's name
    var parameters = {};
    var parametersArray = []
    $.each(labels, function(index, value) {
        var paramName = getCamelCaseParameterName(value.innerText);
        var paramValue = $("input#" + paramName, form).val();
        parameters[paramName] = paramValue;
        parametersArray.push(paramValue);
    });
    // Validating input
    if(validateInput(form, labels, procName, parameters)) {
        // Clearing olddata
        olddata = undefined;
        // Closing dialog
        APP.updateStepDialog.dialog("close");
        // creating label
        label = APP.basicProcedures[procName].label;
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

        // log("Student selected step " + label , {"source":"ipod"});
        
        // Logging selected action
        // log("Select Current Step " + JSON.stringify(APP.currentStep), {"source" : "ipod"});
    }
    // Check if user entered drag mode
    switch(APP.currentStep.name) {
        case "movePoint":           // Fall through
        case "movePointDistance":
            STEPS.startDragMode();
            break;
        case "stopMovingPoint":
            STEPS.stopDragMode();
            break;
    }

}

/*
 * This function takes a camelcase string and outputs a capitalized and spaced string
 * e.g.: camelCase -> Camel Case, aParameter2 -> A Parameter 2
 */
function getPlainParameterName(name){

    var previousIsNum = false;
    // Making the first letter uppercase
    name = name.charAt(0).toUpperCase() + name.slice(1);

    // Checking other letters
    for(var i = 1; i < name.length; i++){
        // Creating conditions
        var isNum = isNumber(name.charAt(i));
        var isFirstNumber = !previousIsNum && isNum;
        var isUpperCase = !isNum && name.charAt(i).toUpperCase() === name.charAt(i);
        
        if(isFirstNumber || isUpperCase){
            // If this is a number, set the previous flag as true
            if(isNumber(name.charAt(i))){ 
                previousIsNum = true;
            } else {
                previousIsNum = false;
            }
            // Adding the space character
            name = name.slice(0, i) + ' ' + name.slice(i, name.length);
            // moving to next i
            i++;
        }
    }
    return name;
}

/*
 * This function takes a capitalized string and outputs a camelCase string.
 * e.g.: Camel Case -> camelCase, A Parameter 2 -> aParameter2
 */
function getCamelCaseParameterName(name){
    // Lowering the case of the first character
    name = name.charAt(0).toLowerCase() + name.slice(1);
    // Replacing space
    name = name.split(' ').join('');
    return name;
};

function validateInput(form, labels, procName, parameters){
    /*
     * Validation is performed based on the procedure's name.
     * Ideally, it would be done based on each parameter's 
     * data types. Currently, parameters do not have data type.
     */
    // procName = getPlainParameterName(procName);
    if(procName === 'moveDistance'){
        // Checks if the parameters is a number or if it's within range
        if(!isNumber(parameters['distance'])){
            toggleError(labels, "color", "red", "black");
            return false;
        } else if(parameters['distance'] == 0){
            alert("Distance has to be greater than 0");
            return false;
        }
    } else if(procName === 'turnAngle'){
        if(!isNumber(parameters['angle']) || parameters['angle'] > 360 || (parameters['angle'] % 90) !== 0){
            if(parameters['angle'] % 90 !== 0) {
                alert("Angle has to be a multiple of 90");
            }
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
function executeStep(event) {
    // log("Student selected 'Execute All Steps'",{"source":"ipod"});
    
    //Doing this since executeStep is also called when we reset via problem header. For that case, don't need to log this function.
    if(event) {
        // var initialStateOnLoadString  = calculateInitialStateOnLoad();
        log("", {"type":"replay","parameter":"", "initial" : "", "final" : ""}, true);
    }

    if(event !== undefined){
        event.preventDefault();
    }
    var grabMode = false;
    for(var i in APP.currentStepsList){
        var step = APP.currentStepsList[i];
        switch(step.name){ 
            case "movePoint":         // Fall through
            case "movePointDistance":
                grabMode = true;
                break;
            case "stopMovingPoint":
                grabMode = false;
                break;
        }
    }
    if(grabMode){
        STEPS.startDragMode();
    } else {
        STEPS.stopDragMode();
    }
    COMM.sendToApplet(JSON.stringify(APP.currentStepsList));
}