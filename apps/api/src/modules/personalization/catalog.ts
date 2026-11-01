// Original educational self-reflection prompts. This is not a licensed MBTI test.
export const quizVersion = "preference-v1";
const axes = [
  {
    letters: ["E", "I"],
    prompts: [
      "Tôi thấy có năng lượng khi trò chuyện cùng nhóm.",
      "Tôi dễ bắt đầu cuộc trò chuyện với người mới.",
      "Tôi thích chia sẻ suy nghĩ thành lời.",
      "Tôi thích có người đồng hành khi khám phá nơi mới.",
      "Tôi thường chủ động rủ bạn tham gia hoạt động.",
      "Tôi thích trao đổi ý tưởng trực tiếp.",
    ],
  },
  {
    letters: ["S", "N"],
    prompts: [
      "Tôi thích học qua ví dụ cụ thể.",
      "Tôi để ý các chi tiết thực tế.",
      "Tôi thích hướng dẫn rõ từng bước.",
      "Tôi tin kinh nghiệm đã kiểm chứng khi chọn cách làm.",
      "Tôi ưu tiên điều có thể áp dụng ngay.",
      "Tôi thích mô tả sự việc bằng dữ kiện rõ ràng.",
    ],
  },
  {
    letters: ["T", "F"],
    prompts: [
      "Tôi bắt đầu quyết định bằng phân tích ưu nhược điểm.",
      "Tôi thích tiêu chí nhất quán khi so sánh lựa chọn.",
      "Tôi dễ trình bày lý do cho một quyết định.",
      "Tôi muốn hiểu nguyên nhân trước khi đề xuất giải pháp.",
      "Tôi thích phản hồi cụ thể về cách cải thiện.",
      "Tôi xem xét tính hợp lý khi có ý kiến trái chiều.",
    ],
  },
  {
    letters: ["J", "P"],
    prompts: [
      "Tôi thích lên kế hoạch cho cuối tuần.",
      "Tôi thấy thoải mái khi biết lịch trước.",
      "Tôi thích hoàn thành việc rồi mới nghỉ.",
      "Tôi thường chuẩn bị trước cho chuyến đi.",
      "Tôi thích chia mục tiêu thành các bước.",
      "Tôi thích chốt lựa chọn sau khi cân nhắc đủ.",
    ],
  },
];
export const questions = axes.flatMap((axis, a) =>
  axis.prompts.map((text, n) => ({ id: `q${a * 6 + n + 1}`, text, axis: a }))
);
export function score(answers: { questionId: string; value: number }[]) {
  return axes
    .map((axis, a) => {
      const sum = answers
        .filter((x) => questions.find((q) => q.id === x.questionId)!.axis === a)
        .reduce((total, x) => total + x.value - 3, 0);
      return axis.letters[sum >= 0 ? 0 : 1];
    })
    .join("");
}
export const gateQuestions = [
  { id: "favorite-color", text: "Màu sắc yêu thích của tôi là gì?" },
  { id: "favorite-season", text: "Mùa yêu thích của tôi là gì?" },
  { id: "favorite-pet", text: "Loài vật yêu thích của tôi là gì?" },
];
export const twentyQuestions = [
  "Một sở thích bạn muốn thử là gì?",
  "Món ăn bạn muốn tự nấu là gì?",
  "Bạn thích biển hay núi?",
  "Cuốn sách nào khiến bạn thích thú?",
  "Bạn thích bắt đầu ngày mới thế nào?",
  "Một kỹ năng nhỏ bạn muốn học?",
  "Bạn thích mùa nào nhất?",
  "Bạn chọn bảo tàng hay công viên?",
  "Bài hát nào khiến bạn vui?",
  "Một bộ phim bạn muốn xem lại?",
  "Bạn thích làm gì vào ngày mưa?",
  "Bạn muốn thử môn thể thao nào?",
  "Một điều nhỏ khiến bạn biết ơn hôm nay?",
  "Bạn thích trà hay cà phê?",
  "Một nơi công cộng bạn muốn khám phá?",
  "Bạn thích chơi trò chơi nhóm nào?",
  "Bạn muốn học ngôn ngữ nào?",
  "Bạn thích buổi sáng hay buổi tối?",
  "Một ý tưởng cho cuối tuần thư giãn?",
  "Bạn muốn thử hoạt động sáng tạo nào?",
];
export const truthOrDare = twentyQuestions.map((truth, i) => ({
  truth,
  dare: [
    "Kể một câu chuyện vui ngắn.",
    "Mô tả một con vật bằng ba từ.",
    "Nghĩ ra tên cho một quán cà phê tưởng tượng.",
    "Chia sẻ một lời chúc tử tế.",
    "Đặt tên cho một màu sắc mới.",
  ][i % 5],
}));
