"use client";

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";

interface Question {
  category: string;
  type: string;
  difficulty: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface QuizResponse {
  response_code: number;
  results: Question[];
}

export default function SinglePlayer() {
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setSelectedAnswer(null);
    setIsCorrect(null);

    try {
      const response = await fetch(
        "https://opentdb.com/api.php?amount=1&type=multiple"
      );
      const data: QuizResponse = await response.json();

      if (data.response_code === 0 && data.results.length > 0) {
        const newQuestion = data.results[0];
        setQuestion(newQuestion);

        // Decode HTML entities in the question and answers
        const decodedQuestion = {
          ...newQuestion,
          question: decodeHTMLEntities(newQuestion.question),
          correct_answer: decodeHTMLEntities(newQuestion.correct_answer),
          incorrect_answers:
            newQuestion.incorrect_answers.map(decodeHTMLEntities),
        };

        setQuestion(decodedQuestion);

        // Shuffle answers
        const allAnswers = [
          decodedQuestion.correct_answer,
          ...decodedQuestion.incorrect_answers,
        ];
        setAnswers(shuffleArray(allAnswers));
      }
    } catch (error) {
      console.error("Error fetching question:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const decodeHTMLEntities = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.innerHTML = text;
    return textArea.value;
  };

  const shuffleArray = (array: string[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer !== null || !question) return;

    setSelectedAnswer(answer);
    const correct = answer === question.correct_answer;
    setIsCorrect(correct);

    if (correct) {
      setScore((prev) => prev + 1);
    }

    setQuestionCount((prev) => prev + 1);
  };

  const handleNextQuestion = () => {
    fetchQuestion();
  };

  useEffect(() => {
    fetchQuestion();
  }, [fetchQuestion]);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <Link to="/">
            <button className="p-2 rounded-full hover:bg-gray-700">Home</button>
          </Link>
          <div className="text-xl font-semibold">
            Score: {score}/{questionCount}
          </div>
        </div>
        <h2 className="text-xl text-center mb-2">
          {loading ? "Loading question..." : question?.category}
        </h2>
        <div className="text-sm text-center text-gray-300 uppercase mb-4">
          {!loading && question && `Difficulty: ${question.difficulty}`}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">Loading...</div>
        ) : (
          <>
            <div className="text-xl mb-6 text-center p-4 bg-gray-700 rounded-lg">
              {question?.question}
            </div>
            <div className="grid gap-3">
              {answers.map((answer, index) => {
                let buttonClass = "py-3 px-4 text-left rounded-md border ";

                if (selectedAnswer === answer) {
                  buttonClass += isCorrect
                    ? "bg-green-600 border-green-500"
                    : "bg-red-600 border-red-500";
                } else if (
                  selectedAnswer &&
                  answer === question?.correct_answer
                ) {
                  buttonClass += "bg-green-600 border-green-500";
                } else {
                  buttonClass += "border-gray-600 hover:bg-gray-700";
                }

                return (
                  <button
                    key={index}
                    className={buttonClass}
                    onClick={() => handleAnswerSelect(answer)}
                    disabled={selectedAnswer !== null}
                  >
                    {answer}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="flex justify-center mt-6">
          {selectedAnswer && (
            <button
              onClick={handleNextQuestion}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              Next Question
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
