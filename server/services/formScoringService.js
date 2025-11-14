const Form = require('../models/Form');

/**
 * Score entire response
 * @param {Form} form - Form document
 * @param {Array} responseDetails - Response details array
 * @returns {Promise<Object>} Scored response with KPIs
 */
exports.scoreResponse = async (form, responseDetails) => {
    try {
        // Score all questions
        const scoredDetails = responseDetails.map(detail => {
            return exports.scoreQuestion(form, detail);
        });
        
        // Calculate section scores
        const sectionScores = exports.calculateSectionScores(form, scoredDetails);
        
        // Calculate form-level KPIs
        const kpis = exports.calculateFormKPIs(form, scoredDetails, sectionScores);
        
        return {
            responseDetails: scoredDetails,
            sectionScores,
            kpis
        };
    } catch (error) {
        console.error('Score response error:', error);
        throw error;
    }
};

/**
 * Score individual question
 * @param {Form} form - Form document
 * @param {Object} responseDetail - Response detail object
 * @returns {Object} Scored response detail
 */
exports.scoreQuestion = (form, responseDetail) => {
    const question = findQuestionInForm(form, responseDetail.questionId);
    if (!question) {
        return {
            ...responseDetail,
            score: 0,
            passFail: 'N/A'
        };
    }
    
    let score = 0;
    let passFail = 'N/A';
    
    // Only score if question has scoring logic
    if (question.scoringLogic && question.scoringLogic.passValue !== undefined) {
        const answer = responseDetail.answer;
        const passValue = question.scoringLogic.passValue;
        const failValue = question.scoringLogic.failValue;
        const weightage = question.scoringLogic.weightage || 0;
        
        // Determine pass/fail based on answer
        if (question.type === 'Yes-No') {
            if (answer === passValue || answer === 'Yes' || answer === true) {
                passFail = 'Pass';
                score = weightage > 0 ? weightage : 100;
            } else if (answer === failValue || answer === 'No' || answer === false) {
                passFail = 'Fail';
                score = 0;
            }
        } else if (question.type === 'Rating') {
            const rating = parseFloat(answer);
            if (!isNaN(rating)) {
                if (rating >= parseFloat(passValue)) {
                    passFail = 'Pass';
                    score = weightage > 0 ? weightage : (rating / 5) * 100;
                } else {
                    passFail = 'Fail';
                    score = weightage > 0 ? (rating / parseFloat(passValue)) * weightage : (rating / 5) * 100;
                }
            }
        } else if (question.type === 'Dropdown') {
            if (answer === passValue) {
                passFail = 'Pass';
                score = weightage > 0 ? weightage : 100;
            } else {
                passFail = 'Fail';
                score = 0;
            }
        } else {
            // For other types, check if answer matches pass value
            if (passValue !== null && passValue !== undefined) {
                if (answer === passValue || (passValue.toString && answer === passValue.toString())) {
                    passFail = 'Pass';
                    score = weightage > 0 ? weightage : 100;
                } else {
                    passFail = 'Fail';
                    score = 0;
                }
            }
        }
    }
    
    return {
        ...responseDetail,
        score,
        passFail
    };
};

/**
 * Calculate section scores
 * @param {Form} form - Form document
 * @param {Array} scoredDetails - Scored response details
 * @returns {Array} Section scores
 */
exports.calculateSectionScores = (form, scoredDetails) => {
    const sectionScores = [];
    
    form.sections.forEach(section => {
        let sectionPassed = 0;
        let sectionFailed = 0;
        let sectionTotal = 0;
        let sectionScore = 0;
        
        section.subsections.forEach(subsection => {
            subsection.questions.forEach(question => {
                const detail = scoredDetails.find(d => d.questionId === question.questionId);
                if (detail) {
                    sectionTotal++;
                    if (detail.passFail === 'Pass') {
                        sectionPassed++;
                    } else if (detail.passFail === 'Fail') {
                        sectionFailed++;
                    }
                    sectionScore += detail.score || 0;
                }
            });
        });
        
        const sectionPercentage = sectionTotal > 0 ? (sectionPassed / sectionTotal) * 100 : 0;
        const avgScore = sectionTotal > 0 ? sectionScore / sectionTotal : 0;
        
        // Apply section weightage
        const weightedScore = (avgScore * (section.weightage || 0)) / 100;
        
        sectionScores.push({
            sectionId: section.sectionId,
            sectionName: section.name,
            passed: sectionPassed,
            failed: sectionFailed,
            total: sectionTotal,
            percentage: Math.round(sectionPercentage * 10) / 10,
            score: Math.round(weightedScore * 10) / 10
        });
    });
    
    return sectionScores;
};

/**
 * Calculate form-level KPIs
 * @param {Form} form - Form document
 * @param {Array} scoredDetails - Scored response details
 * @param {Array} sectionScores - Section scores
 * @returns {Object} Form KPIs
 */
exports.calculateFormKPIs = (form, scoredDetails, sectionScores) => {
    const totalQuestions = scoredDetails.length;
    const totalPassed = scoredDetails.filter(d => d.passFail === 'Pass').length;
    const totalFailed = scoredDetails.filter(d => d.passFail === 'Fail').length;
    
    // Calculate compliance percentage
    const compliancePercentage = totalQuestions > 0 
        ? Math.round((totalPassed / totalQuestions) * 100 * 10) / 10
        : 0;
    
    // Calculate average rating (if form has rating questions)
    const ratingQuestions = scoredDetails.filter(d => {
        const question = findQuestionInForm(form, d.questionId);
        return question && question.type === 'Rating';
    });
    const avgRating = ratingQuestions.length > 0
        ? Math.round((ratingQuestions.reduce((sum, d) => sum + (parseFloat(d.answer) || 0), 0) / ratingQuestions.length) * 10) / 10
        : 0;
    
    // Calculate satisfaction percentage (for Feedback forms)
    const satisfactionPercentage = form.formType === 'Feedback' && ratingQuestions.length > 0
        ? Math.round((avgRating / 5) * 100 * 10) / 10
        : compliancePercentage;
    
    // Calculate final score (weighted average of section scores)
    const totalWeightage = sectionScores.reduce((sum, section) => {
        const formSection = form.sections.find(s => s.sectionId === section.sectionId);
        return sum + (formSection ? formSection.weightage : 0);
    }, 0);
    
    const finalScore = totalWeightage > 0
        ? Math.round((sectionScores.reduce((sum, section) => {
            const formSection = form.sections.find(s => s.sectionId === section.sectionId);
            const sectionWeightage = formSection ? formSection.weightage : 0;
            return sum + (section.score * sectionWeightage / 100);
        }, 0) / totalWeightage) * 100 * 10) / 10
        : compliancePercentage;
    
    return {
        compliancePercentage,
        satisfactionPercentage,
        rating: avgRating,
        totalPassed,
        totalFailed,
        totalQuestions,
        finalScore
    };
};

/**
 * Apply weightage to scores
 * @param {Number} score - Raw score
 * @param {Number} weightage - Weightage percentage
 * @returns {Number} Weighted score
 */
exports.applyWeightage = (score, weightage) => {
    return (score * weightage) / 100;
};

/**
 * Calculate compliance percentage
 * @param {Number} passed - Number of passed items
 * @param {Number} total - Total number of items
 * @returns {Number} Compliance percentage
 */
exports.calculateCompliance = (passed, total) => {
    return total > 0 ? Math.round((passed / total) * 100 * 10) / 10 : 0;
};

/**
 * Find question in form structure
 */
function findQuestionInForm(form, questionId) {
    for (const section of form.sections) {
        for (const subsection of section.subsections) {
            for (const question of subsection.questions) {
                if (question.questionId === questionId) {
                    return question;
                }
            }
        }
    }
    return null;
}

// Export internal functions for testing
exports._findQuestionInForm = findQuestionInForm;

