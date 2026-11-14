import { Link } from 'react-router-dom';
import { MaterialIcon } from '../components/common';

export function NotFoundPage() {


  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      {/* 404 아이콘 */}
      <MaterialIcon
        name="sentiment_dissatisfied"
        className="text-8xl text-text-dim mb-4"
      />

      {/* 404 텍스트 */}
      <h1 className="text-6xl font-bold text-text-base mb-2">
        404
      </h1>

      {/* 설명 */}
      <p className="type-body text-text-muted mb-8">
        페이지를 찾을 수 없습니다.
      </p>

      {/* 홈으로 돌아가기 버튼 */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
      >
        <MaterialIcon size={20} name="home" />
        대시보드로 돌아가기
      </Link>
    </div>
  );
}
