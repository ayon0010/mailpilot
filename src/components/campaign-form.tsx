"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
} from "@/components/ui/field";

import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";

import { CampaignFormValues, createSchema } from "@/schemas/campaign";

export default function CampaignForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      subjectTemplate: "",
      bodyTemplate: "",
      followUpDays: 4,
      targetTimezone: "America/New_York",
      followUpSubjectTemplate: "",
      followUpBodyTemplate: "",
      sendWindowStart: 9,
      sendWindowEnd: 18,
      segmentByLeadTimezone: true,
    },
  });

  const onSubmit = (data: CampaignFormValues) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col md:flex-row gap-10">
        <FieldGroup>
          <Field>
            <FieldLabel>Campaign name</FieldLabel>
            <Input {...register("name")} placeholder="Janitorial Campaign" />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </Field>

          <FieldLegend className="text-lg font-semibold">
            Create Template for the campaign
          </FieldLegend>

          <Field>
            <FieldLabel>Subject</FieldLabel>
            <Input
              {...register("subjectTemplate")}
              placeholder="Quick Question for {{firstName}}"
            />
            {errors.subjectTemplate && (
              <p className="text-sm text-red-500">
                {errors.subjectTemplate.message}
              </p>
            )}
          </Field>

          <Field>
            <FieldLabel>Body</FieldLabel>
            <Textarea {...register("bodyTemplate")} />
            {errors.bodyTemplate && (
              <p className="text-sm text-red-500">
                {errors.bodyTemplate.message}
              </p>
            )}
          </Field>

          <Field>
            <FieldLabel>Follow Up Days</FieldLabel>
            <Input
              type="number"
              min={2}
              max={5}
              {...register("followUpDays")}
            />
            {errors.followUpDays && (
              <p className="text-sm text-red-500">
                {errors.followUpDays.message}
              </p>
            )}
          </Field>
        </FieldGroup>

        <FieldGroup>
          <FieldLegend className="text-lg font-semibold">
            Follow Up Template
          </FieldLegend>

          <Field>
            <FieldLabel>Follow-up Subject</FieldLabel>
            <Input {...register("followUpSubjectTemplate")} />
            {errors.followUpSubjectTemplate && (
              <p className="text-sm text-red-500">
                {errors.followUpSubjectTemplate.message}
              </p>
            )}
          </Field>

          <Field>
            <FieldLabel>Follow-up Body</FieldLabel>
            <Textarea {...register("followUpBodyTemplate")} />
            {errors.followUpBodyTemplate && (
              <p className="text-sm text-red-500">
                {errors.followUpBodyTemplate.message}
              </p>
            )}
          </Field>
        </FieldGroup>
      </div>

      <Button className="mt-6" type="submit">
        Create Campaign
      </Button>
    </form>
  );
}
