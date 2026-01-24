"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Mitchell",
    role: "Mother of 3",
    avatar: "SM",
    rating: 5,
    text: "ParentShield has been a game-changer for our family. My kids used to spend 6+ hours on games daily. Now they're reading, playing outside, and actually doing their homework without being asked!",
  },
  {
    name: "David Chen",
    role: "Tech Professional",
    avatar: "DC",
    rating: 5,
    text: "As someone who works in IT, I was skeptical about parental controls. But ParentShield's tamper protection is seriously impressive. My tech-savvy teenager couldn't bypass it.",
  },
  {
    name: "Emily Rodriguez",
    role: "Working Mom",
    avatar: "ER",
    rating: 5,
    text: "The weekly reports are incredible. I can finally see exactly what my kids are doing online and have meaningful conversations about their digital habits.",
  },
  {
    name: "Michael Thompson",
    role: "Father of 2",
    avatar: "MT",
    rating: 5,
    text: "Setup took 5 minutes and it just works. No more arguments about screen time - the rules are clear and consistent. Worth every penny.",
  },
  {
    name: "Jennifer Park",
    role: "Single Parent",
    avatar: "JP",
    rating: 5,
    text: "I can manage everything from my phone while at work. The instant alerts give me peace of mind knowing my kids are safe online.",
  },
  {
    name: "Robert Williams",
    role: "Grandfather",
    avatar: "RW",
    rating: 5,
    text: "Even I could set it up! Now when the grandkids visit, I don't worry about them stumbling onto inappropriate content. Simple and effective.",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="py-24 bg-surface-base relative">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 text-primary-400 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-4">
            Testimonials
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Loved by <span className="text-gradient">10,000+ Families</span>
          </h2>
          <p className="text-gray-400 text-lg">
            See what parents are saying about ParentShield
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              className="bg-surface-card rounded-2xl p-6 border border-white/5 hover:border-primary-500/20 transition-all duration-300"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -4, boxShadow: "0 0 30px rgba(6, 182, 212, 0.1)" }}
            >
              {/* Quote Icon */}
              <Quote className="w-8 h-8 text-primary-500/30 mb-4" />

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-yellow-500 text-yellow-500"
                  />
                ))}
              </div>

              {/* Text */}
              <p className="text-gray-300 leading-relaxed mb-6 italic">
                &ldquo;{testimonial.text}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
