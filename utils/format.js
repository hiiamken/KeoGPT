/**
 * Chuyển đổi công thức LaTeX sang ký hiệu toán học Unicode.
 * @param {string} text - Chuỗi chứa công thức LaTeX.
 * @returns {string} - Chuỗi đã được chuyển đổi.
 */
function formatMath(text) {
  const replacements = [
    { regex: /\\sqrt\{?(\w+)\}?/g, replacement: "√($1)" }, // Căn bậc hai
    { regex: /\\pm/g, replacement: "±" }, // Cộng trừ
    { regex: /\\times/g, replacement: "×" }, // Nhân
    { regex: /\\div/g, replacement: "÷" }, // Chia
    { regex: /\\neq/g, replacement: "≠" }, // Khác
    { regex: /\\leq/g, replacement: "≤" }, // Nhỏ hơn hoặc bằng
    { regex: /\\geq/g, replacement: "≥" }, // Lớn hơn hoặc bằng
    { regex: /\\approx/g, replacement: "≈" }, // Xấp xỉ
    { regex: /\\infty/g, replacement: "∞" }, // Vô cùng
    { regex: /\\pi/g, replacement: "π" }, // Pi
    { regex: /\\theta/g, replacement: "θ" }, // Theta
    { regex: /\\alpha/g, replacement: "α" }, // Alpha
    { regex: /\\beta/g, replacement: "β" }, // Beta
    { regex: /\\gamma/g, replacement: "γ" }, // Gamma
    { regex: /\\Delta/g, replacement: "Δ" }, // Delta (hoa)
    { regex: /\\delta/g, replacement: "δ" }, // Delta (thường)
    { regex: /\\sum/g, replacement: "Σ" }, // Tổng
    { regex: /\\prod/g, replacement: "∏" }, // Tích
    { regex: /\\int/g, replacement: "∫" }, // Tích phân
    { regex: /\\forall/g, replacement: "∀" }, // Với mọi
    { regex: /\\exists/g, replacement: "∃" }, // Tồn tại
    { regex: /\\in/g, replacement: "∈" }, // Thuộc
    { regex: /\\notin/g, replacement: "∉" }, // Không thuộc
    { regex: /\\subset/g, replacement: "⊂" }, // Tập con (chặt)
    { regex: /\\subseteq/g, replacement: "⊆" }, // Tập con (hoặc bằng)
    { regex: /\\supset/g, replacement: "⊃" }, // Chứa (chặt)
    { regex: /\\supseteq/g, replacement: "⊇" }, // Chứa (hoặc bằng)
    { regex: /\\cup/g, replacement: "∪" }, // Hợp
    { regex: /\\cap/g, replacement: "∩" }, // Giao
    { regex: /\\emptyset/g, replacement: "∅" }, // Tập rỗng
    { regex: /\\to/g, replacement: "→" }, // Mũi tên
    { regex: /\\land/g, replacement: "∧" }, // Và (logic)
    { regex: /\\lor/g, replacement: "∨" }, // Hoặc (logic)
    { regex: /\\neg/g, replacement: "¬" }, // Phủ định
    { regex: /\\angle/g, replacement: "∠" }, // Góc
    { regex: /\\perp/g, replacement: "⊥" }, // Vuông góc
    { regex: /\\parallel/g, replacement: "∥" }, // Song song
    { regex: /\\nparallel/g, replacement: "∦" }, // Không song song
    { regex: /\\therefore/g, replacement: "∴" }, // Do đó
    { regex: /\\because/g, replacement: "∵" }, // Bởi vì
  ];

  // Áp dụng các quy tắc thay thế
  replacements.forEach(({ regex, replacement }) => {
    text = text.replace(regex, replacement);
  });

  // Xử lý phân số: \frac{a}{b} -> (a)/(b)
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)");

  // Xử lý hàm lượng giác: \sin{a} -> sin(a)
  text = text.replace(/\\(sin|cos|tan|log|ln)\{([^}]+)\}/g, "$1($2)");

  // Xử lý số mũ (lũy thừa): a^b -> a^(b)
  text = text.replace(
    /\^(\{([^}]+)\}|[a-zA-Z0-9]+)/g,
    (_, exp) => `^(${exp.replace(/[{}]/g, "")})`
  );

  // Xử lý chỉ số dưới (subscript): a_b -> a_(b)
  text = text.replace(
    /_(\{([^}]+)\}|[a-zA-Z0-9]+)/g,
    (_, sub) => `_(${sub.replace(/[{}]/g, "")})`
  );

  // Giữ nguyên nội dung \text{...}
  text = text.replace(/\\text\{([^}]+)\}/g, "[$1]");

  return text;
}

module.exports = {
  formatMath,
};
