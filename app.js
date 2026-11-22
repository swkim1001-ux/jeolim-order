// =========================================================
// 절임배추 주문 페이지
//  - publishable(공개) 키만 사용합니다. secret 키는 절대 넣지 마세요.
//  - 상품: products 표에서 읽기 (공개 조회 허용된 표)
//  - 주문: place_order 함수(RPC)로만 저장 (orders/customers 표는 잠겨 있음)
// =========================================================
const SUPABASE_URL = "https://hrweexfbhmyxjqqanmhi.supabase.co";
const SUPABASE_KEY = "sb_publishable_7VxI9Go6bmG2sWSpE06YBw_quGVzJtd";

const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
const won = (n) => Number(n).toLocaleString("ko-KR") + "원";
const $ = (id) => document.getElementById(id);

let products = [];

// ---------- 상품 불러오기 ----------
async function loadProducts() {
  const list = $("product-list");
  try {
    const url = `${SUPABASE_URL}/rest/v1/products?select=id,name,weight_kg,price,free_shipping,description&is_active=eq.true&order=id.asc`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("HTTP " + res.status);
    products = await res.json();
  } catch (e) {
    list.innerHTML = '<p class="error">상품 정보를 불러오지 못했어요. 잠시 후 새로고침 해주세요.</p>';
    return;
  }

  if (!products.length) {
    list.innerHTML = '<p class="muted">지금은 판매 중인 상품이 없어요.</p>';
    return;
  }

  list.innerHTML = "";
  products.forEach((p, i) => {
    // 설명에서 "※ ..." 이후의 내부 메모는 손님에게 보여주지 않음
    const desc = (p.description || "").split("※")[0].trim();
    const label = document.createElement("label");
    label.className = "product";
    label.innerHTML = `
      <input type="radio" name="product" value="${Number(p.id)}" ${i === 0 ? "checked" : ""} />
      <div class="p-body">
        <div class="p-name"></div>
        <div class="p-meta"></div>
        <div class="p-price"></div>
        ${desc ? '<p class="p-desc"></p>' : ""}
      </div>`;
    label.querySelector(".p-name").textContent = p.name;
    label.querySelector(".p-meta").textContent = `${p.weight_kg}kg / 1박스`;
    const price = label.querySelector(".p-price");
    price.textContent = won(p.price);
    if (p.free_shipping) {
      const b = document.createElement("span");
      b.className = "badge";
      b.textContent = "무료배송";
      price.appendChild(b);
    }
    if (desc) label.querySelector(".p-desc").textContent = desc;
    list.appendChild(label);
  });

  list.addEventListener("change", updateTotal);
  updateTotal();
}

function selectedProduct() {
  const r = document.querySelector('input[name="product"]:checked');
  return r ? products.find((p) => String(p.id) === r.value) : null;
}

// ---------- 수량 / 금액 ----------
function clampQty() {
  const q = $("qty");
  let v = parseInt(q.value, 10);
  if (isNaN(v) || v < 1) v = 1;
  if (v > 50) v = 50;
  q.value = v;
  return v;
}

function updateTotal() {
  const p = selectedProduct();
  const box = $("total-box");
  if (!p) { box.hidden = true; return; }
  const qty = clampQty();
  $("total-price").textContent = won(p.price * qty);
  $("total-detail").textContent = `${p.name} ${p.weight_kg}kg × ${qty}박스${p.free_shipping ? " · 무료배송" : ""}`;
  box.hidden = false;
}

document.querySelectorAll(".step").forEach((btn) =>
  btn.addEventListener("click", () => {
    const q = $("qty");
    q.value = (parseInt(q.value, 10) || 1) + Number(btn.dataset.step);
    updateTotal();
  })
);
$("qty").addEventListener("change", updateTotal);
$("qty").addEventListener("input", () => { if ($("qty").value !== "") updateTotal(); });

// ---------- 연락처 자동 하이픈 ----------
$("phone").addEventListener("input", (e) => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 11);
  let out = d;
  if (d.startsWith("02")) {
    if (d.length > 9) out = `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
    else if (d.length > 5) out = `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    else if (d.length > 2) out = `${d.slice(0, 2)}-${d.slice(2)}`;
  } else {
    if (d.length > 10) out = `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
    else if (d.length > 6) out = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    else if (d.length > 3) out = `${d.slice(0, 3)}-${d.slice(3)}`;
  }
  e.target.value = out;
});

// ---------- 희망 도착일: 내일 ~ 180일 (한국 시간 기준) ----------
function kstDate(offsetDays) {
  const now = new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return now.toISOString().slice(0, 10);
}
$("date").min = kstDate(1);
$("date").max = kstDate(180);

// ---------- 주문 제출 ----------
function showError(msg, el) {
  const box = $("form-error");
  box.textContent = msg;
  box.hidden = false;
  if (el) { el.classList.add("invalid"); el.focus(); }
}

document.querySelectorAll("#order-form input, #order-form textarea").forEach((el) =>
  el.addEventListener("input", () => { el.classList.remove("invalid"); $("form-error").hidden = true; })
);

$("order-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("form-error").hidden = true;

  const name = $("name").value.trim();
  const phone = $("phone").value.replace(/\D/g, "");
  const address = $("address").value.trim();
  const qty = clampQty();
  const date = $("date").value || null;
  const memo = $("memo").value.trim();
  const p = selectedProduct();

  if (!p) return showError("상품을 선택해주세요.");
  if (!name) return showError("받는 분 이름을 입력해주세요.", $("name"));
  if (!/^0\d{8,10}$/.test(phone)) return showError("연락처를 정확히 입력해주세요. (예: 010-1234-5678)", $("phone"));
  if (!address) return showError("받는 주소를 입력해주세요.", $("address"));
  if (date && (date < $("date").min || date > $("date").max)) return showError("희망 도착일은 내일부터 선택할 수 있어요.", $("date"));
  if (!$("agree").checked) return showError("개인정보 수집·이용에 동의해주세요.", $("agree"));

  const btn = $("submit-btn");
  btn.disabled = true;
  btn.textContent = "주문 접수 중…";

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/place_order`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_name: name,
        p_phone: phone,
        p_address: address,
        p_product_id: p.id,
        p_quantity: qty,
        p_delivery_date: date,
        p_memo: memo || null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data && data.code === "22023" && data.message
        ? data.message
        : "주문 접수 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.";
      throw new Error(msg);
    }
    $("order-no").textContent = String(data);
    $("order").hidden = true;
    $("products").hidden = true;
    $("done").hidden = false;
    $("done").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    showError(err.message || "주문 접수 중 문제가 생겼어요.");
  } finally {
    btn.disabled = false;
    btn.textContent = "주문 접수하기";
  }
});

$("again-btn").addEventListener("click", () => {
  $("order-form").reset();
  $("qty").value = 1;
  $("done").hidden = true;
  $("products").hidden = false;
  $("order").hidden = false;
  const first = document.querySelector('input[name="product"]');
  if (first) first.checked = true;
  updateTotal();
  $("products").scrollIntoView({ behavior: "smooth" });
});

loadProducts();
