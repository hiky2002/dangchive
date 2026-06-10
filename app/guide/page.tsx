"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Section = {
  id: string;
  emoji: string;
  title: string;
  steps: Step[];
};

type Step = {
  text: string;
  sub?: string[];
  note?: string;
};

const sections: Section[] = [
  {
    id: "upload",
    emoji: "📸",
    title: "사진 업로드하는 방법",
    steps: [
      {
        text: "업로드 화면으로 이동한다",
        sub: [
          "방법 A — 홈 화면에서 사진 업로드 카드 누르기",
          "방법 B — 하단 탭에서 올리기 탭 누르기",
        ],
      },
      { text: "가운데 카메라 아이콘 영역을 탭한다" },
      { text: "갤러리에서 사진을 선택하거나 카메라로 직접 촬영한다", note: "최대 50장" },
      { text: "선택한 사진이 그리드로 보이면 확인한다" },
      { text: "잘못 선택했으면 + 다시 선택 버튼으로 다시 고른다" },
      { text: "파란색 올리기 (N장) 버튼을 눌러 업로드한다" },
    ],
  },
  {
    id: "name",
    emoji: "✅",
    title: "이름 지정하기",
    steps: [
      { text: "하단 탭에서 정리하기 탭을 누른다" },
      {
        text: "이름 지정할 사진을 탭해서 선택한다",
        sub: ["여러 장이면 전체 선택 버튼 활용"],
      },
      { text: "하단에 나타나는 🐾 이름 지정하기 버튼을 누른다" },
      {
        text: "아이 목록에서 이름을 찾는다",
        sub: [
          "검색창에 이름을 입력하면 빠르게 찾을 수 있다",
          "여러 마리를 동시에 선택할 수 있다",
        ],
      },
      { text: "아이 이름을 탭해서 선택한다" },
      { text: '"아이이름"(으)로 지정하기 버튼을 누른다' },
      { text: "선택한 사진이 전송 준비 완료 섹션으로 이동한다" },
    ],
  },
  {
    id: "drive",
    emoji: "🚀",
    title: "구글 드라이브로 전송하기",
    steps: [
      { text: "전송 준비 완료 섹션에서 사진을 선택한다", sub: ["전체 선택 가능"] },
      { text: "하단 파란색 🚀 드라이브로 보내기 (N장) 버튼을 누른다" },
      { text: "완료되면 해당 사진이 목록에서 사라진다", note: "다소 시간이 걸릴 수 있어요" },
    ],
  },
  {
    id: "skip",
    emoji: "⏭️",
    title: "이름을 모를 때 넘기기",
    steps: [
      { text: "이름 모르는 사진을 선택한다" },
      { text: "하단 이 아이 누구예요? 버튼을 누른다" },
      { text: "아이 목록에서 지금은 넘기고 나중에 이름 지정하기 → 버튼을 누른다" },
      { text: "사진이 이름 확인 탭으로 이동되어 다른 봉사자가 도움을 줄 수 있다" },
    ],
  },
  {
    id: "add-request",
    emoji: "➕",
    title: "목록에 없는 아이 이름 추가 요청하기",
    steps: [
      { text: "🐾 이름 지정하기 버튼을 눌러 아이 목록을 연다" },
      { text: "검색해도 없으면 목록 하단 + 새 아이 추가 요청 섹션을 찾는다" },
      { text: "추가할 아이 이름을 입력한다" },
      { text: "요청 버튼을 누른다" },
      { text: '노란 배너 "[이름] 승인 대기 중…"이 표시된다' },
      {
        text: "관리자가 승인하면 자동으로 아이가 선택된 상태가 된다",
        sub: ["승인 전까지는 지금은 넘기고 나중에 이름 지정하기 → 버튼으로 넘길 수 있다"],
      },
    ],
  },
  {
    id: "manage",
    emoji: "🐾",
    title: "아이 관리 페이지에서 이름 추가 및 변경 요청",
    steps: [
      { text: "하단 탭에서 아이 관리 탭을 누른다" },
      {
        text: "상단 새 아이 추가 요청 섹션에서 이름을 입력한다",
        sub: ["왼쪽: 내 이름 (선택사항)", "오른쪽: 추가할 아이 이름"],
      },
      { text: "요청 버튼을 누른다" },
      { text: "관리자 승인 후 아이 목록에 자동으로 추가된다" },
    ],
  },
  {
    id: "rename",
    emoji: "✏️",
    title: "이름 변경 요청하기",
    steps: [
      { text: "하단 탭에서 아이 관리 탭을 누른다" },
      { text: "검색창에서 이름을 바꾸고 싶은 아이를 찾는다" },
      { text: "해당 아이 오른쪽 이름 변경 요청 버튼을 누른다" },
      { text: "새로 바꿀 이름을 입력한다" },
      { text: "요청 버튼을 누른다" },
      { text: "관리자가 승인하면 아이 이름이 변경된다" },
    ],
  },
  {
    id: "feedback",
    emoji: "💬",
    title: "불편한 점 의견 보내기",
    steps: [
      { text: "하단 탭에서 홈 탭을 누른다" },
      { text: "맨 아래 💬 의견 보내기 버튼을 누른다" },
      {
        text: "팝업 창에서 내용을 입력한다",
        sub: ["이름 (선택사항)", "의견 내용 (최대 500자)"],
      },
      { text: "보내기 버튼을 누른다" },
      { text: "🎉 화면이 뜨면 전송 완료" },
    ],
  },
];

const adminSections: Section[] = [
  {
    id: "admin-login",
    emoji: "🔑",
    title: "관리자 로그인",
    steps: [
      { text: "홈 화면 하단 🔑 관리자 로그인 버튼을 누른다" },
      { text: "관리자 비밀번호를 입력한다" },
      { text: "확인 버튼을 누른다" },
      { text: "로그인 성공 시 홈이 관리자 모드로 바뀐다" },
    ],
  },
  {
    id: "admin-approve",
    emoji: "📋",
    title: "요청 승인·거절",
    steps: [
      {
        text: "홈 화면 승인 요청 N건 대기 중 배너를 누르거나 아이 관리 탭으로 이동한다",
      },
      {
        text: "화면 상단 대기 중인 요청 섹션에서 요청 목록을 확인한다",
        sub: ["유사한 이름이 이미 있으면 빨간 경고 문구가 표시된다"],
      },
      { text: "✓ 승인 — 아이 목록에 즉시 추가된다" },
      { text: "✗ 거절 — 요청이 삭제된다" },
    ],
  },
  {
    id: "admin-sync",
    emoji: "🔄",
    title: "Google Drive 동기화",
    steps: [
      { text: "아이 관리 탭 상단 드라이브 동기화 버튼을 누른다" },
      { text: "완료 메시지가 뜨면 동기화 완료" },
    ],
  },
  {
    id: "admin-add",
    emoji: "➕",
    title: "아이 직접 추가",
    steps: [
      { text: "아이 관리 탭에서 + 새 아이 직접 추가 섹션을 찾는다" },
      { text: "아이 이름을 입력하고 추가 버튼을 누른다" },
    ],
  },
  {
    id: "admin-edit",
    emoji: "✏️",
    title: "아이 이름 수정 / 삭제",
    steps: [
      { text: "아이 관리 탭에서 해당 아이를 찾는다" },
      { text: "오른쪽 ✏️ — 이름 수정 후 저장", note: "드라이브 내 파일 이름이 수정됨" },
      { text: "오른쪽 🗑️ — 확인 팝업 후 삭제 확정", note: "드라이브 내 파일은 삭제되지 않음" },
    ],
  },
  {
    id: "admin-logout",
    emoji: "🚪",
    title: "로그아웃",
    steps: [
      { text: "홈 화면 또는 아이 관리 탭에서 로그아웃 버튼을 누른다" },
    ],
  },
];

function SectionCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        marginBottom: 10,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 18px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: "#191F28" }}>
          {section.emoji} {section.title}
        </span>
        <span style={{ fontSize: 18, color: "#8B95A1", lineHeight: 1 }}>
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 18px 18px" }}>
          <div
            style={{
              width: "100%",
              height: 1,
              background: "#F2F4F6",
              marginBottom: 14,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {section.steps.map((step, i) => (
              <div
                key={i}
                style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
              >
                <span
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#EEF4FF",
                    color: "#3182F6",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, color: "#333D4B", lineHeight: 1.7 }}>
                {step.text}
                </span>
                {step.note && (
                  <span
                    style={{
                      display: "inline-block",
                      marginLeft: 6,
                      fontSize: 12,
                      color: "#8B95A1",
                      background: "#F2F4F6",
                      borderRadius: 6,
                      padding: "1px 7px",
                    }}
                  >
                    {step.note}
                  </span>
                )}
                {step.sub && (
                  <ul style={{ margin: "4px 0 0", padding: "0 0 0 14px" }}>
                    {step.sub.map((s, j) => (
                      <li
                        key={j}
                        style={{ fontSize: 13, color: "#6B7684", lineHeight: 1.6 }}
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuidePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"volunteer" | "admin">("volunteer");

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#F5F5F5",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#fff",
          borderBottom: "1px solid #F2F4F6",
          padding: "0 4px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px 12px",
            gap: 4,
          }}
        >
          <button
            onClick={() => router.back()}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 8,
              fontSize: 20,
              color: "#191F28",
              lineHeight: 1,
            }}
          >
            ←
          </button>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#191F28" }}>
            이용 가이드
          </span>
        </div>

        {/* Tab */}
        <div style={{ display: "flex", padding: "0 16px 0", gap: 0 }}>
          {(["volunteer", "admin"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "10px 0",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: tab === t ? 700 : 400,
                color: tab === t ? "#3182F6" : "#8B95A1",
                borderBottom: tab === t ? "2px solid #3182F6" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {t === "volunteer" ? "봉사자" : "관리자"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "16px 16px 40px" }}>
        {tab === "volunteer" ? (
          <>
            <p
              style={{
                fontSize: 13,
                color: "#8B95A1",
                marginBottom: 16,
                lineHeight: 1.6,
              }}
            >
              각 항목을 눌러 상세 내용을 확인하세요 🐾
            </p>
            {sections.map((s) => (
              <SectionCard key={s.id} section={s} />
            ))}
          </>
        ) : (
          <>
            <p
              style={{
                fontSize: 13,
                color: "#8B95A1",
                marginBottom: 16,
                lineHeight: 1.6,
              }}
            >
              관리자 전용 기능 안내입니다 🔑
            </p>
            {adminSections.map((s) => (
              <SectionCard key={s.id} section={s} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
