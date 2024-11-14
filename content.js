console.log("VIT Feedback Automator: content.js has been successfully injected.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startFeedbackAutomation") {
        console.log("VIT Feedback Automator: Received 'startFeedbackAutomation' message.");
        const userRating = request.rating;
        const userSuggestion = request.suggestion;
        startAutomation(userRating, userSuggestion)
            .then(() => {
                sendResponse({ status: "Feedback automation completed." });
            })
            .catch(error => {
                sendResponse({ status: "Feedback automation failed.", error: error.message });
            });
        return true;
    }
});

async function startAutomation(rating, suggestion) {
    try {
        const syllabusCourses = extractSyllabusCourses();

        const outcomeCourses = extractOutcomeCourses();

        if (syllabusCourses.length === 0 && outcomeCourses.length === 0) {
            alert("No courses available for feedback.");
            console.warn("VIT Feedback Automator: No courses found for feedback.");
            return;
        }

        console.log(`VIT Feedback Automator: Found ${syllabusCourses.length} syllabus course(s) and ${outcomeCourses.length} outcome course(s) for feedback.`);

        for (const [index, course] of syllabusCourses.entries()) {
            console.log(`VIT Feedback Automator: Processing syllabus feedback for course ${index + 1}/${syllabusCourses.length} - ${course.courseCode} - ${course.courseTitle}`);
            await postSyllabusFeedback(course, rating, suggestion);
            await delay(1000);
        }

        for (const [index, course] of outcomeCourses.entries()) {
            console.log(`VIT Feedback Automator: Processing outcome feedback for course ${index + 1}/${outcomeCourses.length} - ${course.courseCode} - ${course.courseTitle}`);
            await postOutcomeFeedback(course, rating);
            await delay(1000);
        }

        alert("All feedback submissions completed successfully.");
        console.log("VIT Feedback Automator: All feedback submissions completed successfully.");
    } catch (error) {
        console.error("VIT Feedback Automator: Error during automation:", error);
        alert("An error occurred during feedback automation. Check console for details.");
    }
}

function extractSyllabusCourses() {
    const courses = [];
    const tables = document.querySelectorAll('table');

    tables.forEach((table, tableIndex) => {
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
        console.log(`VIT Feedback Automator: Table ${tableIndex + 1} headers:`, headers);

        if (headers.includes("Sl. No.") && headers.includes("Course Code")) {
            console.log("VIT Feedback Automator: Found the syllabus/teacher feedback table.");
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td');
                console.log(`VIT Feedback Automator: Table ${tableIndex + 1} Row ${rowIndex + 1} has ${cells.length} cells.`);

                if (cells.length < 15) {
                    console.warn(`VIT Feedback Automator: Skipping row ${rowIndex + 1} in syllabus table due to insufficient cells (${cells.length} cells).`);
                    return; 
                }

                const statusCell = cells[14];
                const postButton = statusCell.querySelector('button');

                if (postButton) { 
                    const onclickAttr = postButton.getAttribute('onclick');
                    console.log(`VIT Feedback Automator: Found 'Post' button with onclick: ${onclickAttr}`);
                    if (onclickAttr) {
                        const matches = onclickAttr.match(/processCourseFeedbackPerception\('([^']+)',\s*'([^']+)'\)/);
                        if (matches && matches.length === 3) {
                            courses.push({
                                courseId: matches[1],
                                courseType: matches[2],
                                courseCode: cells[2].innerText.trim(),
                                courseTitle: cells[3].innerText.trim(),
                                facultyName: cells[13].innerText.trim()
                            });
                            console.log(`VIT Feedback Automator: Added syllabus course - ID: ${matches[1]}, Type: ${matches[2]}`);
                        } else {
                            console.warn(`VIT Feedback Automator: Could not parse 'onclick' attribute for syllabus course: ${onclickAttr}`);
                        }
                    } else {
                        console.warn("VIT Feedback Automator: No 'onclick' attribute found on Post button for syllabus course.");
                    }
                } else {
                    console.log(`VIT Feedback Automator: Syllabus course "${cells[2].innerText.trim()}" already posted.`);
                }
            });
        }
    });

    return courses;
}

function extractOutcomeCourses() {
    const courses = [];
    const tables = document.querySelectorAll('table');

    tables.forEach((table, tableIndex) => {
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
        console.log(`VIT Feedback Automator: Table ${tableIndex + 1} headers:`, headers);

        if (headers.includes("Sl. No.") && headers.includes("Course Code") && headers.includes("Generic Type")) {
            console.log("VIT Feedback Automator: Found the course outcomes feedback table.");
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td');
                console.log(`VIT Feedback Automator: Table ${tableIndex + 1} Row ${rowIndex + 1} has ${cells.length} cells.`);

                if (cells.length < 10) {
                    console.warn(`VIT Feedback Automator: Skipping row ${rowIndex + 1} in outcomes table due to insufficient cells (${cells.length} cells).`);
                    return; 
                }

                const statusCell = cells[9];
                const postButton = statusCell.querySelector('button');

                if (postButton) { 
                    const onclickAttr = postButton.getAttribute('onclick');
                    console.log(`VIT Feedback Automator: Found 'Post' button with onclick: ${onclickAttr}`);
                    if (onclickAttr) {
                        const matches = onclickAttr.match(/processCourseOutcomeFeedbackPerception\('([^']+)'\)/);
                        if (matches && matches.length === 2) {
                            courses.push({
                                courseId: matches[1],
                                courseCode: cells[1].innerText.trim(),
                                courseTitle: cells[2].innerText.trim(),
                                genericType: cells[3].innerText.trim()
                            });
                            console.log(`VIT Feedback Automator: Added outcome course - ID: ${matches[1]}`);
                        } else {
                            console.warn(`VIT Feedback Automator: Could not parse 'onclick' attribute for outcome course: ${onclickAttr}`);
                        }
                    } else {
                        console.warn("VIT Feedback Automator: No 'onclick' attribute found on Post button for outcome course.");
                    }
                } else {
                    console.log(`VIT Feedback Automator: Outcome course "${cells[1].innerText.trim()}" already posted.`);
                }
            });
        }
    });

    return courses;
}

async function postSyllabusFeedback(course, rating, suggestion) {
    console.log(`VIT Feedback Automator: Submitting syllabus feedback for Course ID: ${course.courseId}, Type: ${course.courseType}`);

    const processEndpoint = "https://web.vit.ac.in/endfeedback/processCourseFeedbackPerception";

    const processPayload = new URLSearchParams();
    processPayload.append('courseId', course.courseId);
    processPayload.append('courseType', course.courseType);

    const processResponse = await fetch(processEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: processPayload
    });

    if (!processResponse.ok) {
        throw new Error(`Failed to process syllabus feedback for ${course.courseId}`);
    }

    const processHtml = await processResponse.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(processHtml, 'text/html');

    const courseIdField = doc.querySelector('input[name="courseId"]');
    const courseTypeField = doc.querySelector('input[name="courseType"]');

    if (!courseIdField || !courseTypeField) {
        throw new Error(`Failed to extract hidden fields for syllabus course ${course.courseId}`);
    }

    const courseId = courseIdField.value;
    const courseType = courseTypeField.value;

    console.log(`VIT Feedback Automator: Extracted Course ID: ${courseId}, Type: ${courseType}`);

    const feedbackAnswers = generateSyllabusFeedbackAnswers(rating, suggestion);

    const formData = new URLSearchParams();
    formData.append('courseId', courseId);
    formData.append('courseType', courseType);

    feedbackAnswers.forEach(answer => {
        formData.append('ansType', answer.ansType);
        formData.append('qno', answer.qno);
        formData.append(answer.qno, answer.response);
    });

    const saveEndpoint = "https://web.vit.ac.in/endfeedback/saveCourseFeedbackPerception";

    const saveResponse = await fetch(saveEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
    });

    if (!saveResponse.ok) {
        throw new Error(`Failed to save syllabus feedback for ${course.courseId}`);
    }

    const saveHtml = await saveResponse.text();

    console.log(`VIT Feedback Automator: Syllabus feedback submitted for Course ID: ${course.courseId}`);
}

async function postOutcomeFeedback(course, rating) {
    console.log(`VIT Feedback Automator: Submitting outcome feedback for Course ID: ${course.courseId}`);

    const processEndpoint = "https://web.vit.ac.in/endfeedback/processCourseOutcomeFeedbackPerception";

    const processPayload = new URLSearchParams();
    processPayload.append('courseId', course.courseId);

    const processResponse = await fetch(processEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: processPayload
    });

    if (!processResponse.ok) {
        throw new Error(`Failed to process outcome feedback for ${course.courseId}`);
    }

    const processHtml = await processResponse.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(processHtml, 'text/html');

    const courseIdField = doc.querySelector('input[name="courseId"]');

    if (!courseIdField) {
        throw new Error(`Failed to extract hidden fields for outcome course ${course.courseId}`);
    }

    const courseId = courseIdField.value;

    console.log(`VIT Feedback Automator: Extracted Course ID: ${courseId}`);

    const feedbackAnswers = generateOutcomeFeedbackAnswers(doc, rating);

    if (feedbackAnswers.length === 0) {
        throw new Error(`No feedback questions found for outcome course ${course.courseId}`);
    }

    const formData = new URLSearchParams();
    formData.append('courseId', courseId);

    feedbackAnswers.forEach(answer => {
        formData.append('ansType', answer.ansType);
        formData.append('qno', answer.qno);
        formData.append(answer.qno, answer.response);
    });

    const saveEndpoint = "https://web.vit.ac.in/endfeedback/saveCourseOutcomeFeedbackPerception";

    const saveResponse = await fetch(saveEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
    });

    if (!saveResponse.ok) {
        throw new Error(`Failed to save outcome feedback for ${course.courseId}`);
    }

    const saveHtml = await saveResponse.text();

    console.log(`VIT Feedback Automator: Outcome feedback submitted for Course ID: ${course.courseId}`);
}

function generateSyllabusFeedbackAnswers(rating, suggestion) {
    const answers = [
        { ansType: 1, qno: 'FBA01', response: rating },
        { ansType: 1, qno: 'FBA02', response: rating },
        { ansType: 1, qno: 'FBA03', response: rating },
        { ansType: 1, qno: 'FBA04', response: rating },
        { ansType: 1, qno: 'FBA05', response: rating },
        { ansType: 1, qno: 'FBA06', response: rating },
        { ansType: 2, qno: 'FBS01', response: suggestion }, 
        { ansType: 1, qno: 'FBA07', response: rating },
        { ansType: 1, qno: 'FBA08', response: rating },
        { ansType: 1, qno: 'FBA09', response: rating },
        { ansType: 1, qno: 'FBA10', response: rating },
        { ansType: 1, qno: 'FBA11', response: rating },
        { ansType: 1, qno: 'FBA12', response: rating },
        { ansType: 1, qno: 'FBA13', response: rating },
        { ansType: 2, qno: 'FBS02', response: suggestion }  
    ];

    return answers;
}


function generateOutcomeFeedbackAnswers(doc, rating) {
    const answers = [];
    const form = doc.querySelector('form#CourseOutcomeFeedbackPerception');
    if (!form) {
        console.warn("VIT Feedback Automator: Feedback form not found.");
        return answers;
    }

    const tables = form.querySelectorAll('table');
    if (tables.length === 0) {
        console.warn("VIT Feedback Automator: No tables found within the feedback form.");
        return answers;
    }

    tables.forEach((table, tableIndex) => {
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
        if (headers.includes("Category") && headers.includes("Statements") && headers.includes("Rating")) {
            console.log(`VIT Feedback Automator: Found feedback questions table at index ${tableIndex + 1}.`);
            const feedbackRows = table.querySelectorAll('tbody tr');

            feedbackRows.forEach((row, rowIndex) => {
                const ansTypeField = row.querySelector('input[name="ansType"]');
                const qnoField = row.querySelector('input[name="qno"]');

                if (ansTypeField && qnoField) {
                    const ansType = ansTypeField.value.trim();
                    const qno = qnoField.value.trim();
                    const response = rating.toString();

                    answers.push({
                        ansType: ansType,
                        qno: qno,
                        response: response
                    });

                    console.log(`VIT Feedback Automator: Prepared outcome feedback - QNo: ${qno}, AnsType: ${ansType}, Response: ${response}`);
                } else {
                    console.warn(`VIT Feedback Automator: Incomplete feedback data in outcome course row ${rowIndex + 1}.`);
                }
            });
        }
    });

    if (answers.length === 0) {
        console.warn("VIT Feedback Automator: No feedback questions found in any table.");
    }

    return answers;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
