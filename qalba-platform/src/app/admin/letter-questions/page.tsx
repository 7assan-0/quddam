import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { LetterQuestionManager } from "@/components/letter-question-manager";
export default async function LetterQuestionsPage(){
  const user=await requireUser();if(user.role!=="ADMIN")notFound();
  const [questions,categories]=await Promise.all([db().letterQuestion.findMany({include:{category:{select:{title:true}}},orderBy:{createdAt:"desc"},take:200}),
    db().category.findMany({where:{active:true},select:{id:true,title:true},orderBy:{sortOrder:"asc"}})]);
  return <div className="shell letter-page"><div className="page-title"><span className="eyebrow">إدارة المحتوى</span><h1>أسئلة شبكة الحروف</h1><p>الإجابة والبدائل تبدأ بالحرف المحدد. التعديل لا يغير نسخ الأسئلة داخل المباريات.</p></div>
    <LetterQuestionManager initial={questions.map(q=>({id:q.id,letter:q.letter,question:q.question,answer:q.answer,categoryId:q.categoryId,difficulty:q.difficulty,status:q.status,alternativeAnswers:q.alternativeAnswers,category:q.category.title}))} categories={categories}/></div>;
}

