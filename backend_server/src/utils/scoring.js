const prisma = require('../config/database');

async function calculateScore(userId, examId, questions) {
  let totalPoints = 0;
  let earnedPoints = 0;
  let correctAnswers = 0;

  for (const question of questions) {
    totalPoints += question.points;

    if (question.type !== 'multiple_choice') continue;

    const answer = await prisma.answer.findUnique({
      where: { userId_examId_questionId: { userId, examId, questionId: question.id } },
    });

    if (!answer?.optionId) continue;

    const correctOption = question.options.find(o => o.isCorrect);
    if (correctOption && answer.optionId === correctOption.id) {
      correctAnswers++;
      earnedPoints += question.points;
    }
  }

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100 * 100) / 100 : 0;
  return { score, totalQuestions: questions.length, correctAnswers };
}

module.exports = { calculateScore };
