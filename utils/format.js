// utils/format.js
function formatMath(text) {
    text = text.replace(/\\sqrt\{?(\w+)\}?/g, "√($1)");   // Căn bậc hai
    text = text.replace(/\\pm/g, "±");     // Cộng trừ
    text = text.replace(/\\times/g, "×");    // Nhân
    text = text.replace(/\\div/g, "÷");      // Chia
    text = text.replace(/\\neq/g, "≠");     // Khác
    text = text.replace(/\\leq/g, "≤");     // Nhỏ hơn hoặc bằng
    text = text.replace(/\\geq/g, "≥");     // Lớn hơn hoặc bằng
    text = text.replace(/\\approx/g, "≈");  // Xấp xỉ
    text = text.replace(/\\infty/g, "∞");   // Vô cùng
    text = text.replace(/\\pi/g, "π");      // Pi
    text = text.replace(/\\theta/g, "θ");   // Theta
    text = text.replace(/\\alpha/g, "α");   // Alpha
    text = text.replace(/\\beta/g, "β");    // Beta
    text = text.replace(/\\gamma/g, "γ");   // Gamma
    text = text.replace(/\\Delta/g, "Δ");   // Delta (hoa)
    text = text.replace(/\\delta/g, "δ");   // Delta (thường)
    text = text.replace(/\\sum/g, "Σ");     // Tổng
    text = text.replace(/\\prod/g, "∏");    // Tích
    text = text.replace(/\\int/g, "∫");     // Tích phân
    text = text.replace(/\\forall/g, '∀');  // Với mọi
    text = text.replace(/\\exists/g, '∃');  // Tồn tại
    text = text.replace(/\\in/g, '∈');      // Thuộc
    text = text.replace(/\\notin/g, '∉');   // Không thuộc
    text = text.replace(/\\subset/g, '⊂');  // Tập con (chặt)
    text = text.replace(/\\subseteq/g, '⊆'); // Tập con (hoặc bằng)
    text = text.replace(/\\supset/g, '⊃');  // Chứa (chặt)
    text = text.replace(/\\supseteq/g, '⊇'); // Chứa (hoặc bằng)
    text = text.replace(/\\cup/g, '∪');      // Hợp
    text = text.replace(/\\cap/g, '∩');      // Giao
    text = text.replace(/\\emptyset/g, '∅'); // Tập rỗng
    text = text.replace(/\\to/g, '→');      // Mũi tên
    text = text.replace(/\\land/g, '∧');      // Và (logic)
    text = text.replace(/\\lor/g, '∨');       // Hoặc (logic)
    text = text.replace(/\\neg/g, '¬');       // Phủ định
    text = text.replace(/\\frac{([^}]+)}{([^}]+)}/g, "($1)/($2)"); // Phân số
    text = text.replace(/\\sin\(([^)]+)\)/g, 'sin($1)');          // sin
    text = text.replace(/\\cos\(([^)]+)\)/g, 'cos($1)');          //cos
    text = text.replace(/\\tan\(([^)]+)\)/g, 'tan($1)');          //tan
    // Xử lý số mũ (lũy thừa):
    text = text.replace(/\^([a-zA-Z0-9]+|\([^)]*\))/g, '^($1)');
    // Xử lý chỉ số dưới (subscript):
    text = text.replace(/_\{([^}]+)\}|_([a-zA-Z0-9]+|\((?:[^()]|\([^()]*\))*\))/g, (match, braceContent, otherContent) => {
        const content = braceContent || otherContent;
        return `_(${content})`;
    });

    // Xử lý \text{...}:
    text = text.replace(/\\text\{([^}]+)\}/g, '$1');

    return text;
}

module.exports = {
    formatMath,
};