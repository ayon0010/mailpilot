// // app/campaigns/new/page.tsx
// "use client";
// import { useState } from "react";
// import { useRouter } from "next/navigation";

// export default function NewCampaignPage() {
//   const router = useRouter();
//   const [form, setForm] = useState({
//     name: "",
//     subjectTemplate: "",
//     bodyTemplate: "",
//     followUpSubjectTemplate: "",
//     followUpBodyTemplate: "",
//     followUpDays: 4,
//     targetTimezone: "America/New_York",
//     sendWindowStart: 9,
//     sendWindowEnd: 18,
//   });

//   async function handleSubmit(e: React.FormEvent) {
//     e.preventDefault();
//     const res = await fetch("/api/campaigns", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(form),
//     });
//     const data = await res.json();
//     if (data.campaign) router.push(`/campaigns/${data.campaign.id}`);
//   }

//   return (
//     <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 600 }}>
//       <h1>New Campaign</h1>
//       <form
//         onSubmit={handleSubmit}
//         style={{ display: "flex", flexDirection: "column", gap: 12 }}
//       >
//         <input
//           placeholder="Campaign name"
//           value={form.name}
//           onChange={(e) => setForm({ ...form, name: e.target.value })}
//           required
//         />
//         <input
//           placeholder="Subject (use {{firstName}} etc.)"
//           value={form.subjectTemplate}
//           onChange={(e) =>
//             setForm({ ...form, subjectTemplate: e.target.value })
//           }
//           required
//         />
//         <textarea
//           placeholder="Body"
//           value={form.bodyTemplate}
//           onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
//           rows={4}
//           required
//         />
//         <input
//           placeholder="Follow-up subject"
//           value={form.followUpSubjectTemplate}
//           onChange={(e) =>
//             setForm({ ...form, followUpSubjectTemplate: e.target.value })
//           }
//         />
//         <textarea
//           placeholder="Follow-up body"
//           value={form.followUpBodyTemplate}
//           onChange={(e) =>
//             setForm({ ...form, followUpBodyTemplate: e.target.value })
//           }
//           rows={4}
//         />
//         <label>
//           Follow-up after (days):{" "}
//           <input
//             type="number"
//             value={form.followUpDays}
//             onChange={(e) =>
//               setForm({ ...form, followUpDays: Number(e.target.value) })
//             }
//           />
//         </label>
//         <label>
//           Target timezone:{" "}
//           <input
//             value={form.targetTimezone}
//             onChange={(e) =>
//               setForm({ ...form, targetTimezone: e.target.value })
//             }
//           />
//         </label>
//         <label>
//           Window start hour:{" "}
//           <input
//             type="number"
//             value={form.sendWindowStart}
//             onChange={(e) =>
//               setForm({ ...form, sendWindowStart: Number(e.target.value) })
//             }
//           />
//         </label>
//         <label>
//           Window end hour:{" "}
//           <input
//             type="number"
//             value={form.sendWindowEnd}
//             onChange={(e) =>
//               setForm({ ...form, sendWindowEnd: Number(e.target.value) })
//             }
//           />
//         </label>
//         <button type="submit">Create Draft Campaign</button>
//       </form>
//     </div>
//   );
// }

import CampaignForm from "@/components/campaign-form";
import React from "react";

const NewCampaignPage = () => {
  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl">Create New Campaign</h1>
      <CampaignForm />
    </div>
  );
};

export default NewCampaignPage;
