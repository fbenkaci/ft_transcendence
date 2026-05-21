"use client"

import Link from "next/link"
import { use, useEffect } from "react"
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
					<div key={i} className={`ball ball-${i + 1}`}/>
				))}
			</div>

			<div className="login-circle">
				{/*
					faut changer les images
					les mails et les passwords 
				*/}
				<center>
					<img
					src="/test.jpg"
					alt="Profile"
					className="login-avatar"
				/>
				</center>
				
				<center>
					<h2 className="login-username">Username</h2>
					<div className="tr-input fake-input">
						table-en4
					</div>
				</center>
				

				<div className="tr-input fake-input">
					<center>
						molapoug@student.42.fr
					</center>
					
				</div>

				<div className="tr-input fake-input">
					<center>
						*********
					</center>
				</div>

			</div>
			<Link href="/" className="home-btn">
				<House className="w-6 h-6"/>
			</Link>

			<Link href="/account" className="account-btn">
				<User className="w-6 h-6" />
			</Link>

			<div className="net" aria-hidden="true"/>			
		</main>
	)
}
