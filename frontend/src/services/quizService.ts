/**
 * Quiz Generation Service
 * Generates quiz questions based on original study material
 */

export type QuestionType = 'mcq-single' | 'mcq-multiple' | 'descriptive';

export type MCQOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type QuizQuestion = {
  id: string;
  type: QuestionType;
  question: string;
  options?: MCQOption[]; // For MCQ questions
  correctAnswerIds?: string[]; // For MCQ (single or multiple)
  sampleAnswer?: string; // For descriptive questions
  points: number;
};

export type Quiz = {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  totalPoints: number;
  passingScore: number; // Percentage (e.g., 70)
  timeLimit?: number; // Minutes (optional)
};

export type QuizAnswer = {
  questionId: string;
  selectedOptionIds?: string[]; // For MCQ
  textAnswer?: string; // For descriptive (typed)
  uploadedFile?: File; // For descriptive (handwritten)
};

export type QuizResult = {
  score: number; // Percentage
  totalPoints: number;
  earnedPoints: number;
  passed: boolean;
  feedback: {
    questionId: string;
    correct: boolean;
    userAnswer: string;
    correctAnswer: string;
    explanation: string;
  }[];
}

/**
 * Generate quiz from original study material
 * In production, this would use AI to analyze the content and create relevant questions
 * 
 * @param originalFileName - Name of the original study material
 * @param analysisData - Optional analysis data from recall comparison
 * @returns Generated quiz
 */
export const generateQuiz = async (
  originalFileName: string,
  analysisData?: any
): Promise<Quiz> => {
  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 2500));

  // In production, AI would:
  // 1. Extract key concepts from original material
  // 2. Identify important facts, formulas, theories
  // 3. Generate diverse question types
  // 4. Focus on areas user struggled with (from analysisData)
  
  const questions: QuizQuestion[] = [
    // MCQ Single Correct
    {
      id: 'q1',
      type: 'mcq-single',
      question: 'What is the main concept discussed in this topic?',
      options: [
        { id: 'q1-opt1', text: 'Fundamental principles and their applications', isCorrect: true },
        { id: 'q1-opt2', text: 'Historical background only', isCorrect: false },
        { id: 'q1-opt3', text: 'Practical examples without theory', isCorrect: false },
        { id: 'q1-opt4', text: 'None of the above', isCorrect: false }
      ],
      correctAnswerIds: ['q1-opt1'],
      points: 10
    },
    
    // MCQ Multiple Correct
    {
      id: 'q2',
      type: 'mcq-multiple',
      question: 'Which of the following are key characteristics of this topic? (Select all that apply)',
      options: [
        { id: 'q2-opt1', text: 'Requires understanding of fundamentals', isCorrect: true },
        { id: 'q2-opt2', text: 'Has practical applications', isCorrect: true },
        { id: 'q2-opt3', text: 'Only relevant in theory', isCorrect: false },
        { id: 'q2-opt4', text: 'Builds on previous concepts', isCorrect: true }
      ],
      correctAnswerIds: ['q2-opt1', 'q2-opt2', 'q2-opt4'],
      points: 15
    },

    // MCQ Single Correct
    {
      id: 'q3',
      type: 'mcq-single',
      question: 'What is the primary application of this concept?',
      options: [
        { id: 'q3-opt1', text: 'Solving real-world problems', isCorrect: true },
        { id: 'q3-opt2', text: 'Academic research only', isCorrect: false },
        { id: 'q3-opt3', text: 'No practical use', isCorrect: false },
        { id: 'q3-opt4', text: 'Historical reference', isCorrect: false }
      ],
      correctAnswerIds: ['q3-opt1'],
      points: 10
    },

    // Descriptive Question
    {
      id: 'q4',
      type: 'descriptive',
      question: 'Explain the core principle of this topic and provide one practical example of its application.',
      sampleAnswer: 'The core principle involves... A practical example is...',
      points: 15
    },

    // Descriptive Question
    {
      id: 'q5',
      type: 'descriptive',
      question: 'Describe the relationship between this topic and related concepts you have studied.',
      sampleAnswer: 'This topic relates to... because...',
      points: 10
    }
  ];

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  return {
    id: `quiz-${Date.now()}`,
    title: `Quiz: ${originalFileName.replace(/\.[^/.]+$/, '')}`,
    description: 'Test your understanding of the key concepts and their applications.',
    questions,
    totalPoints,
    passingScore: 70, // 70% to pass
    timeLimit: 15 // 15 minutes
  };
};

/**
 * Evaluate quiz answers
 * Auto-grades MCQ questions, uses AI to evaluate descriptive answers
 * 
 * @param quiz - The quiz being evaluated
 * @param answers - User's answers
 * @returns Quiz result with score and feedback
 */
export const evaluateQuiz = async (
  quiz: Quiz,
  answers: QuizAnswer[]
): Promise<QuizResult> => {
  // Simulate AI evaluation delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  let earnedPoints = 0;
  const feedback: QuizResult['feedback'] = [];

  for (const question of quiz.questions) {
    const userAnswer = answers.find(a => a.questionId === question.id);
    
    if (!userAnswer) {
      feedback.push({
        questionId: question.id,
        correct: false,
        userAnswer: 'No answer provided',
        correctAnswer: getCorrectAnswerText(question),
        explanation: 'Question was not answered'
      });
      continue;
    }

    if (question.type === 'mcq-single' || question.type === 'mcq-multiple') {
      // Auto-grade MCQ
      const correctIds = new Set(question.correctAnswerIds || []);
      const userIds = new Set(userAnswer.selectedOptionIds || []);
      
      const isCorrect = 
        correctIds.size === userIds.size &&
        [...correctIds].every(id => userIds.has(id));

      if (isCorrect) {
        earnedPoints += question.points;
      }

      feedback.push({
        questionId: question.id,
        correct: isCorrect,
        userAnswer: [...userIds].map(id => 
          question.options?.find(opt => opt.id === id)?.text || ''
        ).join(', '),
        correctAnswer: [...correctIds].map(id =>
          question.options?.find(opt => opt.id === id)?.text || ''
        ).join(', '),
        explanation: isCorrect 
          ? '✓ Correct!' 
          : 'The correct answer(s) focus on the key principles discussed in the material.'
      });

    } else if (question.type === 'descriptive') {
      // AI evaluation for descriptive questions
      // In production, use AI to compare with sample answer
      // For now, give partial credit based on answer length
      const answerText = userAnswer.textAnswer || '';
      const hasUpload = !!userAnswer.uploadedFile;
      
      // Simple heuristic: give credit if answer has substance
      const hasSubstance = answerText.length > 50 || hasUpload;
      const pointsEarned = hasSubstance ? Math.floor(question.points * 0.8) : 0;
      
      earnedPoints += pointsEarned;

      feedback.push({
        questionId: question.id,
        correct: pointsEarned > 0,
        userAnswer: answerText || (hasUpload ? '[Handwritten answer uploaded]' : 'No answer'),
        correctAnswer: question.sampleAnswer || 'See study material for details',
        explanation: hasSubstance
          ? '✓ Good effort! Your answer demonstrates understanding of the concept.'
          : 'Answer needs more detail. Review the core concepts in your study material.'
      });
    }
  }

  const score = Math.round((earnedPoints / quiz.totalPoints) * 100);
  const passed = score >= quiz.passingScore;

  return {
    score,
    totalPoints: quiz.totalPoints,
    earnedPoints,
    passed,
    feedback
  };
};

/**
 * Helper function to get correct answer text
 */
function getCorrectAnswerText(question: QuizQuestion): string {
  if (question.type === 'descriptive') {
    return question.sampleAnswer || 'See study material';
  }
  
  const correctOptions = question.options?.filter(opt => opt.isCorrect);
  return correctOptions?.map(opt => opt.text).join(', ') || 'N/A';
}
