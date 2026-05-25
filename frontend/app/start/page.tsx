"use client";

import Link from "next/link";
import { useEffect } from "react";
import { User } from 'lucide-react';
import { House } from 'lucide-react';

const house = () => {
  return (
    <House />
  );
};

const App = () => {
  return (
    <User />
  );
};

export default function Page() {
  useEffect(() => {
	const btn = document.getElementById("start-btn");
	if (!btn) return;
	const handleActive = () => {
	  btn.classList.add("active");
	  setTimeout(() => btn.classList.remove("active"), 150);
	};
	btn.addEventListener("mousedown", handleActive);
	return () => btn.removeEventListener("mousedown", handleActive);
  }, []);

  return (
	<main className="tr-wrap">
	  <div className="balls-layer" aria-hidden="true">
		{[...Array(5)].map((_, i) => (
		  <div key={i} className={`ball ball-${i + 1}`} />
		))}
	  </div>

	  <div className="net" aria-hidden="true" />

	  <div className="content">
		<div className="title-row">
		  <svg
			className="racket-svg"
			width="48"
			height="48"
			viewBox="0 0 44 44"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		  >
			<ellipse cx="19" cy="19" rx="14" ry="14" stroke="#CDE6F5" strokeWidth="2.2" fill="none" opacity="0.9" />
			<line x1="19" y1="5" x2="19" y2="33" stroke="#CDE6F5" strokeWidth="1.2" opacity="0.4" />
			<line x1="5" y1="19" x2="33" y2="19" stroke="#CDE6F5" strokeWidth="1.2" opacity="0.4" />
			<line x1="9" y1="9" x2="29" y2="29" stroke="#CDE6F5" strokeWidth="1" opacity="0.25" />
			<line x1="29" y1="9" x2="9" y2="29" stroke="#CDE6F5" strokeWidth="1" opacity="0.25" />
			<line x1="26" y1="30" x2="38" y2="42" stroke="#CDE6F5" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
		  </svg>
		  <h1 className="title">Wanna play ?</h1>
		</div>

		<Link href="/" className="home-btn">
			<House className="w-6 h-6"/>
		</Link>

		<Link href="/account" className="account-btn">
			<User className="w-6 h-6" />
		</Link>		

		<div className="btn-group">
			<Link href="/1vs1" className="btn-start">
				1 vs 1
			</Link>
		  <div className="btn-row">
			<Link href="/online" className="btn-ghost">
			  Online
			</Link>
			<Link href="/ia_vs" className="btn-ghost">
              1 vs 1 IA 🤖
            </Link>
		  </div>
		</div>
	  </div>
	</main>
  );
}